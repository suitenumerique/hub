import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { ChatMessage } from "@/features/drivers/types";

import type { UseChatMessagesResult } from "./useChatMessages";
import type { UseMainTimelineUnreadResult } from "./useMainTimelineUnread";
import type { MarkedUnreadGate } from "./useMarkedUnreadGate";
import { usePageVisible } from "./usePageVisible";

type UseConversationOpeningParams = Pick<
  UseChatMessagesResult,
  | "messages"
  | "isInitialLoading"
  | "windowVersion"
  | "openAround"
  | "openLatest"
> & {
  unread: UseMainTimelineUnreadResult;
  markedUnread: MarkedUnreadGate;
};

/** The first message a read marker leaves unread: the next from someone else. */
const firstUnreadAfter = (
  messages: ChatMessage[],
  markerId: string,
): string | null => {
  const markerIndex = messages.findIndex((message) => message.id === markerId);
  return (
    messages
      .slice(markerIndex + 1)
      .find((message) => message.authorId !== "me" && !message.isDeleted)?.id ??
    null
  );
};

/**
 * Where the conversation opens. Like Element's jump to the read marker, with
 * unread messages it opens on the first one, loading the messages around it
 * behind the skeleton when the latest ones do not hold it: it never opens at
 * the bottom and then jumps. Otherwise it opens on the latest messages.
 *
 * Once it shows, it is read as a whole, not only the messages in view; threads
 * keep their own unread replies. A tab in the background shows nothing: reading
 * waits for the page to be visible, not for it to have the focus.
 */
export const useConversationOpening = ({
  messages,
  isInitialLoading,
  windowVersion,
  openAround,
  openLatest,
  unread,
  markedUnread,
}: UseConversationOpeningParams) => {
  // `undefined` until it is known, `null` to open on the latest messages.
  const [targetId, setTargetId] = useState<string | null>();
  const [openedWindow, setOpenedWindow] = useState<number | null>(null);
  const isOpened = openedWindow !== null;
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current || isInitialLoading || unread.isLoading) {
      return;
    }
    hasStartedRef.current = true;
    const { hasUnread, firstUnreadId, readUpToId } = unread;
    const findTarget = async (): Promise<string | null> => {
      if (!hasUnread) {
        return null;
      }
      if (
        firstUnreadId &&
        messages.some((message) => message.id === firstUnreadId)
      ) {
        return firstUnreadId;
      }
      const aroundId = firstUnreadId ?? readUpToId;
      const opened = aroundId
        ? await openAround(aroundId).catch(() => null)
        : null;
      if (!opened) {
        return null;
      }
      // A marker on an event the timeline does not show, such as a reaction,
      // opens on the next message.
      if (firstUnreadId || opened.anchorId !== readUpToId) {
        return opened.anchorId;
      }
      const target = firstUnreadAfter(opened.messages, opened.anchorId);
      if (!target) {
        await openLatest();
      }
      return target;
    };
    void findTarget().then(setTargetId);
  }, [isInitialLoading, messages, openAround, openLatest, unread]);

  // Opens as soon as the messages hold the target. Those of a loaded window
  // reach this render after `openAround` has resolved.
  if (
    !isOpened &&
    !isInitialLoading &&
    targetId !== undefined &&
    (targetId === null || messages.some((message) => message.id === targetId))
  ) {
    setOpenedWindow(windowVersion);
  }

  // Before paint, so that the jump to the latest messages does not flash its
  // new-message dot.
  const isPageVisible = usePageVisible();
  const isReadRef = useRef(false);
  useLayoutEffect(() => {
    if (!isOpened || !isPageVisible || isReadRef.current) {
      return;
    }
    isReadRef.current = true;
    unread.markAllRead(messages.at(-1)?.id);
    if (markedUnread.isMarkedUnread) {
      markedUnread.clearIfAllowed();
    }
  }, [isOpened, isPageVisible, markedUnread, messages, unread]);

  return {
    isOpened,
    /**
     * The message the visit opened on. Like Element's read marker line, the
     * separator stays before it even once the conversation is read.
     */
    openedOnId: isOpened ? (targetId ?? null) : null,
    /** Its index, for the window it opened with only. */
    openingIndex:
      targetId && openedWindow === windowVersion
        ? messages.findIndex((message) => message.id === targetId)
        : -1,
  };
};
