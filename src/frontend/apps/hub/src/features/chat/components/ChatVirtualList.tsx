import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import type { ChatRef } from "@/features/drivers/types";

import { useChatMessages } from "../hooks/useChatMessages";
import { useChatUnreadState } from "../hooks/useChatUnread";
import { useMarkChatRead } from "../hooks/useMarkChatRead";
import { useReadAtLiveEnd } from "../hooks/useReadAtLiveEnd";
import { useUnreadJump } from "../hooks/useUnreadJump";
import { useVisibleUnreadMessage } from "../hooks/useVisibleUnreadMessage";

import { ChatConversationSkeleton } from "./ChatConversationSkeleton";
import { ChatMessageRow } from "./ChatMessageRow";

type ChatVirtualListProps = {
  chatRef: ChatRef;
  onUnreadNavigationChange?: (
    update: MainTimelineUnreadNavigationUpdate,
  ) => void;
};

export type MainTimelineUnreadNavigation = {
  count: number;
  isOpening: boolean;
  isMarkingRead: boolean;
  open: () => void;
  markRead: () => void;
};

export type MainTimelineUnreadNavigationUpdate = {
  chatKey: string;
  navigation: MainTimelineUnreadNavigation | null;
};

const DEFAULT_ITEM_HEIGHT = 72;
// Virtuoso stays mounted between conversations. Give it one measurement pass
// before applying the new conversation's imperative live-end position.
const INITIAL_POSITION_DELAY_MS = 250;

type SkeletonState = "visible" | "leaving" | "hidden";

const scheduleComposerFocusRestore = (
  focusOrigin: Element | null,
  restoreFromBody = false,
): void => {
  const focusCameFromUnreadControls =
    focusOrigin instanceof HTMLElement &&
    (focusOrigin.matches("[data-unread-separator]") ||
      Boolean(focusOrigin.closest(".hub__unread-banner")));
  if (
    !focusCameFromUnreadControls &&
    !(restoreFromBody && focusOrigin === document.body)
  ) {
    return;
  }
  requestAnimationFrame(() => {
    if (
      document.activeElement !== focusOrigin &&
      document.activeElement !== document.body
    ) {
      return;
    }
    document
      .querySelector<HTMLInputElement>(
        "[data-chat-composer-input]:not(:disabled)",
      )
      ?.focus();
  });
};

export const ChatVirtualList = ({
  chatRef,
  onUnreadNavigationChange,
}: ChatVirtualListProps) => {
  const { t } = useTranslation();
  const chatKey = `${chatRef.accountId}:${chatRef.chatId}`;

  const { unread, isPending: isUnreadPending } = useChatUnreadState(chatRef);
  const {
    messages,
    authorsById,
    firstUnreadMessageId,
    anchorStatus,
    isUnreadWindowActive,
    liveEndMessageId,
    hasOlder,
    hasNewer,
    isFetchingOlder,
    isFetchingNewer,
    isInitialLoading,
    firstItemIndex,
    fetchOlder,
    fetchNewer,
    openFirstUnread,
    closeUnreadContext,
  } = useChatMessages(chatRef, {
    enabled: !isUnreadPending,
  });
  const lastMessage = messages[messages.length - 1];
  const markChatRead = useMarkChatRead(chatRef);
  const messageIndexById = useMemo(
    () => new Map(messages.map((message, index) => [message.id, index])),
    [messages],
  );
  const firstUnreadIndex = firstUnreadMessageId
    ? (messageIndexById.get(firstUnreadMessageId) ?? -1)
    : -1;

  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const [isPositioned, setIsPositioned] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isLiveReadArmed, setIsLiveReadArmed] = useState(false);
  const [scrollerElement, setScrollerElement] = useState<HTMLElement | null>(
    null,
  );
  const [markingMessageId, setMarkingMessageId] = useState<string | null>(null);
  const isMarkingMainRead = markingMessageId !== null;
  const [skeletonState, setSkeletonState] = useState<SkeletonState>("visible");
  const needsInitialPosition = isInitialLoading || !isPositioned;

  const closeUnreadWindowAndReturnToLiveEnd = useCallback(
    (restoreFocusIfLost = false) => {
      scheduleComposerFocusRestore(document.activeElement, restoreFocusIfLost);
      closeUnreadContext();
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: "LAST",
          align: "end",
          behavior: "auto",
        });
        setIsAtBottom(true);
      });
    },
    [closeUnreadContext],
  );
  const handleUnreadJumpAborted = useCallback(
    () => closeUnreadWindowAndReturnToLiveEnd(true),
    [closeUnreadWindowAndReturnToLiveEnd],
  );

  const unreadJump = useUnreadJump({
    chatKey,
    enabled: unread.mainTimelineUnread,
    // Virtuoso's imperative API uses the zero-based data index even when
    // rendered item callbacks receive indices offset by `firstItemIndex`.
    targetIndex: firstUnreadIndex,
    openFirstUnread,
    virtuosoRef,
    onJumpAborted: handleUnreadJumpAborted,
    isContextActive: isUnreadWindowActive,
    onAtBottomChange: setIsAtBottom,
  });
  const isJumpingToUnread = unreadJump.isJumping;
  const hasUnreadContext = unreadJump.hasUnreadContext;
  const handleScrollerRef = useCallback(
    (element: HTMLElement | Window | null) => {
      unreadJump.scrollerRef(element);
      setScrollerElement(element instanceof HTMLElement ? element : null);
    },
    [unreadJump.scrollerRef],
  );

  const visibleReadMessageId = useVisibleUnreadMessage({
    enabled: unread.mainTimelineUnread && isPositioned,
    scroller: scrollerElement,
    messageIndexById,
    firstUnreadIndex,
    isJumping: isJumpingToUnread,
    hasUnreadContext,
  });

  const closeUnreadNavigation = useCallback(() => {
    const shouldReturnToLiveEnd = hasUnreadContext || isJumpingToUnread;
    if (shouldReturnToLiveEnd) {
      closeUnreadWindowAndReturnToLiveEnd(hasUnreadContext);
    } else {
      closeUnreadContext();
    }
    unreadJump.reset();
  }, [
    closeUnreadContext,
    closeUnreadWindowAndReturnToLiveEnd,
    hasUnreadContext,
    isJumpingToUnread,
    unreadJump.reset,
  ]);

  const partialReadEnabled =
    unread.mainTimelineUnread &&
    !isInitialLoading &&
    !isJumpingToUnread &&
    !isMarkingMainRead &&
    isPositioned &&
    firstUnreadIndex >= 0 &&
    visibleReadMessageId !== null;
  const liveEndReadEnabled =
    unread.mainTimelineUnread &&
    !isInitialLoading &&
    !hasNewer &&
    !isJumpingToUnread &&
    !isMarkingMainRead &&
    isLiveReadArmed &&
    isPositioned &&
    isAtBottom;
  const submitRead = useReadAtLiveEnd({
    chatKey,
    enabled: partialReadEnabled || liveEndReadEnabled,
    messageId: partialReadEnabled ? visibleReadMessageId : liveEndMessageId,
    markRead: markChatRead,
  });

  useEffect(() => {
    if (!isUnreadPending && !unread.mainTimelineUnread) {
      closeUnreadNavigation();
    }
  }, [closeUnreadNavigation, isUnreadPending, unread.mainTimelineUnread]);

  // Do not erase an existing backlog just because a conversation initially
  // opens at its live end. Reading becomes automatic only after the room was
  // already read, or after the user explicitly opened the unread context.
  useEffect(() => {
    if (
      isLiveReadArmed ||
      isInitialLoading ||
      !isPositioned ||
      isJumpingToUnread ||
      (unread.mainTimelineUnread && !hasUnreadContext)
    ) {
      return;
    }
    const raf = requestAnimationFrame(() => setIsLiveReadArmed(true));
    return () => cancelAnimationFrame(raf);
  }, [
    hasUnreadContext,
    isInitialLoading,
    isJumpingToUnread,
    isLiveReadArmed,
    isPositioned,
    unread.mainTimelineUnread,
  ]);

  useEffect(() => {
    if (needsInitialPosition) {
      setSkeletonState("visible");
      return;
    }
    const raf = requestAnimationFrame(() => {
      setSkeletonState((current) =>
        current === "visible" ? "leaving" : current,
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [needsInitialPosition]);

  // Conversations open at the live end; unread context is installed only by
  // the explicit banner action. A height callback is not sufficient here:
  // switching between equally-sized conversations may not emit one.
  useEffect(() => {
    if (isInitialLoading || isPositioned || anchorStatus === null) {
      return;
    }
    let raf: number | null = null;
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: "LAST",
          align: "end",
          behavior: "auto",
        });
        setIsAtBottom(true);
        setIsPositioned(true);
      });
    }, INITIAL_POSITION_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      if (raf !== null) {
        cancelAnimationFrame(raf);
      }
    };
  }, [anchorStatus, isInitialLoading, isPositioned]);

  // `endReached` can fire while the unread jump is still animating. Once the
  // jump settles, reaching the contextual bottom must still load toward live.
  useEffect(() => {
    if (
      isPositioned &&
      isAtBottom &&
      hasNewer &&
      !isJumpingToUnread &&
      !isFetchingNewer
    ) {
      fetchNewer();
    }
  }, [
    fetchNewer,
    hasNewer,
    isAtBottom,
    isFetchingNewer,
    isJumpingToUnread,
    isPositioned,
  ]);

  const handleMarkMainRead = useCallback(() => {
    if (!liveEndMessageId || markingMessageId !== null) {
      return;
    }
    const focusOrigin = document.activeElement;
    const messageId = liveEndMessageId;
    setMarkingMessageId(messageId);
    void submitRead(messageId)
      .then((result) => {
        if (result.status !== "unavailable") {
          closeUnreadNavigation();
          scheduleComposerFocusRestore(focusOrigin);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        setMarkingMessageId((current) =>
          current === messageId ? null : current,
        );
      });
  }, [closeUnreadNavigation, liveEndMessageId, markingMessageId, submitRead]);

  const hasActiveMainUnread =
    unread.mainTimelineUnread && !isInitialLoading && isPositioned;
  const showUnreadSeparator =
    hasActiveMainUnread &&
    firstUnreadMessageId !== null &&
    firstUnreadIndex >= 0;
  const unreadNavigation = useMemo<MainTimelineUnreadNavigation | null>(() => {
    if (!hasActiveMainUnread) {
      return null;
    }
    return {
      count: unread.mainTimelineCount,
      isOpening: isJumpingToUnread,
      isMarkingRead: isMarkingMainRead,
      open: unreadJump.open,
      markRead: handleMarkMainRead,
    };
  }, [
    handleMarkMainRead,
    hasActiveMainUnread,
    isJumpingToUnread,
    isMarkingMainRead,
    unread.mainTimelineCount,
    unreadJump.open,
  ]);
  const unreadNavigationUpdate = useMemo<MainTimelineUnreadNavigationUpdate>(
    () => ({ chatKey, navigation: unreadNavigation }),
    [chatKey, unreadNavigation],
  );

  useEffect(() => {
    onUnreadNavigationChange?.(unreadNavigationUpdate);
  }, [onUnreadNavigationChange, unreadNavigationUpdate]);

  useEffect(
    () => () => onUnreadNavigationChange?.({ chatKey, navigation: null }),
    [chatKey, onUnreadNavigationChange],
  );

  return (
    <div className="hub__chat-conversation__list">
      {!isInitialLoading ? (
        <Virtuoso
          ref={virtuosoRef}
          scrollerRef={handleScrollerRef}
          data={messages}
          firstItemIndex={firstItemIndex}
          computeItemKey={(_index, message) => message.id}
          defaultItemHeight={DEFAULT_ITEM_HEIGHT}
          initialTopMostItemIndex={Math.max(0, messages.length - 1)}
          followOutput={(atBottom) =>
            !isJumpingToUnread &&
            !hasNewer &&
            (atBottom || lastMessage?.authorId === "me")
              ? "auto"
              : false
          }
          isScrolling={unreadJump.onScrolling}
          atBottomStateChange={(atBottom) => {
            setIsAtBottom(atBottom);
          }}
          startReached={hasOlder ? fetchOlder : undefined}
          endReached={hasNewer && !isJumpingToUnread ? fetchNewer : undefined}
          increaseViewportBy={{ top: 400, bottom: 400 }}
          components={{
            Header: () => (
              <div className="hub__chat-conversation__top-spacer">
                {isFetchingOlder ? (
                  <TimelineStatus label={t("Loading older messages…")} />
                ) : null}
              </div>
            ),
            Footer: () =>
              isFetchingNewer ? (
                <div className="hub__chat-conversation__bottom-loader">
                  <TimelineStatus label={t("Loading newer messages…")} />
                </div>
              ) : null,
          }}
          itemContent={(virtualIndex, message) => {
            const arrayIndex = virtualIndex - firstItemIndex;
            const isFirstUnread =
              showUnreadSeparator && message.id === firstUnreadMessageId;
            const nextMessage = messages[arrayIndex + 1];
            // The separator also breaks sender grouping on both sides.
            return (
              <ChatMessageRow
                message={message}
                chatRef={chatRef}
                prev={isFirstUnread ? undefined : messages[arrayIndex - 1]}
                next={
                  nextMessage?.id === firstUnreadMessageId
                    ? undefined
                    : nextMessage
                }
                authorsById={authorsById}
                showUnreadSeparator={isFirstUnread}
                unreadSeparatorRef={
                  isFirstUnread ? unreadJump.separatorRef : undefined
                }
              />
            );
          }}
        />
      ) : null}
      {skeletonState !== "hidden" ? (
        <ChatConversationSkeleton
          leaving={skeletonState === "leaving"}
          onLeaveEnd={() =>
            setSkeletonState((current) =>
              current === "leaving" ? "hidden" : current,
            )
          }
        />
      ) : null}
    </div>
  );
};

const TimelineStatus = ({ label }: { label: string }) => (
  <div
    className="hub__chat-conversation__top-loader"
    role="status"
    data-loading
  >
    <span className="material-icons" aria-hidden="true">
      sync
    </span>
    {label}
  </div>
);
