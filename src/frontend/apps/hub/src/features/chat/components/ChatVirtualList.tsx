import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import type { ChatRef } from "@/features/drivers/types";

import { useChatMessages } from "../hooks/useChatMessages";
import {
  type MainTimelineUnreadNavigation,
  useMainTimelineUnread,
} from "../hooks/useMainTimelineUnread";
import { useChatUnreadState } from "../hooks/useChatUnread";
import { useMarkChatRead } from "../hooks/useMarkChatRead";

import { ChatConversationSkeleton } from "./ChatConversationSkeleton";
import { ChatMessageRow } from "./ChatMessageRow";

export type { MainTimelineUnreadNavigation } from "../hooks/useMainTimelineUnread";

type ChatVirtualListProps = {
  chatRef: ChatRef;
  onUnreadNavigationChange?: (
    update: MainTimelineUnreadNavigationUpdate,
  ) => void;
};

export type MainTimelineUnreadNavigationUpdate = {
  chatKey: string;
  navigation: MainTimelineUnreadNavigation | null;
};

const DEFAULT_ITEM_HEIGHT = 72;
const INITIAL_POSITION_DELAY_MS = 250;

type SkeletonState = "visible" | "leaving" | "hidden";

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
    hasOlder,
    hasNewer,
    isFetchingOlder,
    isFetchingNewer,
    isInitialLoading,
    firstItemIndex,
    fetchOlder,
    fetchNewer,
    openFirstUnread,
  } = useChatMessages(chatRef, {
    enabled: !isUnreadPending,
    readBoundaryId: unread.mainTimelineReadBoundaryId,
  });

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const wasConnectedToLive = useRef(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [skeletonState, setSkeletonState] = useState<SkeletonState>("visible");
  const markChatRead = useMarkChatRead(chatRef);
  const activeUnread =
    unread.mainTimelineUnread && !isInitialLoading && isPositioned;
  const unreadDomain = useMainTimelineUnread({
    chatKey,
    messages,
    firstUnreadMessageId,
    unreadCount: unread.mainTimelineCount,
    enabled: activeUnread,
    hasNewer,
    openFirstUnread,
    markRead: markChatRead,
  });
  const messageIndexById = useMemo(
    () => new Map(messages.map((message, index) => [message.id, index])),
    [messages],
  );
  const jumpTargetIndex = unreadDomain.jump.targetId
    ? (messageIndexById.get(unreadDomain.jump.targetId) ?? -1)
    : -1;
  const needsInitialPosition = isInitialLoading || !isPositioned;
  const wasConnectedToLiveBeforeRender = wasConnectedToLive.current;

  useEffect(() => {
    wasConnectedToLive.current = !hasNewer;
  }, [chatKey, hasNewer]);

  useEffect(() => {
    if (!scroller) {
      return;
    }
    const onUserScroll = unreadDomain.onUserScroll;
    scroller.addEventListener("wheel", onUserScroll, { passive: true });
    scroller.addEventListener("touchmove", onUserScroll, { passive: true });
    scroller.addEventListener("pointerdown", onUserScroll, { passive: true });
    return () => {
      scroller.removeEventListener("wheel", onUserScroll);
      scroller.removeEventListener("touchmove", onUserScroll);
      scroller.removeEventListener("pointerdown", onUserScroll);
    };
  }, [scroller, unreadDomain.onUserScroll]);

  useEffect(() => {
    if (needsInitialPosition) {
      setSkeletonState("visible");
      return;
    }
    const frame = requestAnimationFrame(() => {
      setSkeletonState((current) =>
        current === "visible" ? "leaving" : current,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [needsInitialPosition]);

  useEffect(() => {
    if (isInitialLoading || isPositioned || anchorStatus === null) {
      return;
    }
    let frame: number | null = null;
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: "LAST",
          align: "end",
          behavior: "auto",
        });
        setIsPositioned(true);
      });
    }, INITIAL_POSITION_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [anchorStatus, isInitialLoading, isPositioned]);

  useEffect(() => {
    if (jumpTargetIndex < 0) {
      return;
    }
    const scrollToUnread = () =>
      virtuosoRef.current?.scrollToIndex({
        index: jumpTargetIndex,
        align: "start",
        behavior: "auto",
      });
    let settleTimer: number | null = null;
    const frame = requestAnimationFrame(() => {
      scrollToUnread();
      // The contextual window replaces a differently measured list. Reapply
      // the same relative index once Virtuoso has measured the new rows.
      settleTimer = window.setTimeout(() => {
        scrollToUnread();
        requestAnimationFrame(unreadDomain.completeJump);
      }, INITIAL_POSITION_DELAY_MS);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
    };
  }, [jumpTargetIndex, unreadDomain.completeJump, unreadDomain.jump.request]);

  const unreadNavigationUpdate = useMemo<MainTimelineUnreadNavigationUpdate>(
    () => ({ chatKey, navigation: unreadDomain.navigation }),
    [chatKey, unreadDomain.navigation],
  );
  useEffect(() => {
    onUnreadNavigationChange?.(unreadNavigationUpdate);
  }, [onUnreadNavigationChange, unreadNavigationUpdate]);
  useEffect(
    () => () => onUnreadNavigationChange?.({ chatKey, navigation: null }),
    [chatKey, onUnreadNavigationChange],
  );

  const lastMessage = messages.at(-1);
  const firstUnreadIndex = unreadDomain.firstUnreadIndex;
  const showUnreadSeparator = activeUnread && firstUnreadIndex >= 0;
  const handleScrollerRef = useCallback(
    (element: HTMLElement | Window | null) =>
      setScroller(element instanceof HTMLElement ? element : null),
    [],
  );
  const reportVisibleRange = useCallback(() => {
    if (!scroller) {
      return;
    }
    const viewport = scroller.getBoundingClientRect();
    const rendered = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-index]"),
    );
    const intersecting = rendered.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > viewport.top && rect.top < viewport.bottom;
    });
    const fullyVisible = intersecting.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top >= viewport.top && rect.bottom <= viewport.bottom;
    });
    const visible = fullyVisible.length > 0 ? fullyVisible : intersecting;
    const indices = visible
      // Virtuoso's DOM `data-index` is relative to `data`, even when the
      // callback index is offset by `firstItemIndex`.
      .map((element) => Number(element.dataset.index))
      .filter(Number.isInteger);
    if (indices.length === 0) {
      return;
    }
    const separatorRect =
      unreadDomain.separatorRef.current?.getBoundingClientRect();
    const separatorVisible = Boolean(
      separatorRect &&
      separatorRect.bottom > viewport.top &&
      separatorRect.top < viewport.bottom,
    );
    unreadDomain.onVisibleRangeChanged(
      {
        startIndex: Math.min(...indices),
        endIndex: Math.max(...indices),
      },
      separatorVisible,
    );
  }, [scroller, unreadDomain.onVisibleRangeChanged, unreadDomain.separatorRef]);

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
            !hasNewer &&
            atBottom &&
            (!activeUnread ||
              (wasConnectedToLiveBeforeRender &&
                lastMessage?.authorId === "me"))
              ? "auto"
              : false
          }
          isScrolling={(isScrolling) => {
            if (!isScrolling) {
              reportVisibleRange();
            }
            unreadDomain.onScrolling(isScrolling);
          }}
          rangeChanged={reportVisibleRange}
          atBottomStateChange={(atBottom) => {
            unreadDomain.onAtBottomChange(atBottom);
          }}
          startReached={hasOlder ? fetchOlder : undefined}
          endReached={hasNewer ? fetchNewer : undefined}
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
              showUnreadSeparator && arrayIndex === firstUnreadIndex;
            const nextMessage = messages[arrayIndex + 1];
            return (
              <ChatMessageRow
                message={message}
                chatRef={chatRef}
                prev={isFirstUnread ? undefined : messages[arrayIndex - 1]}
                next={
                  arrayIndex + 1 === firstUnreadIndex ? undefined : nextMessage
                }
                authorsById={authorsById}
                showUnreadSeparator={isFirstUnread}
                unreadSeparatorRef={
                  isFirstUnread ? unreadDomain.separatorRef : undefined
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
