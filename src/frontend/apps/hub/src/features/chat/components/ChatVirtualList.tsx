import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatRef,
} from "@/features/drivers/types";

import { isSameChatDay } from "../formatTimestamp";
import { useChatMessages } from "../hooks/useChatMessages";
import { useMainTimelineUnread } from "../hooks/useMainTimelineUnread";

import { ChatBubble } from "./ChatBubble";
import { ChatConversationSkeleton } from "./ChatConversationSkeleton";
import type { UnreadMessagesBannerProps } from "./UnreadMessagesBanner";
import { UnreadSeparator } from "./UnreadSeparator";

type ChatVirtualListProps = {
  chatRef: ChatRef;
  onUnreadBannerChange: (
    chatKey: string,
    banner: UnreadMessagesBannerProps | null,
  ) => void;
};

const DEFAULT_ITEM_HEIGHT = 72;
// Debounce viewport checks until Virtuoso scrolling and layout have settled.
const VISIBILITY_SETTLE_MS = 150;
// After measuring, require focused visibility before marking a message read.
const READ_DWELL_MS = 250;
// A message qualifies as visible only when 60% of its rendered height is shown.
const MESSAGE_VISIBILITY_RATIO = 0.6;

type SkeletonState = "visible" | "leaving" | "hidden";
type UnreadViewportState = "unknown" | "all-visible" | "needs-navigation";

type UnreadSeparatorState = {
  chatKey: string;
  eventId: string;
  isVisible: boolean;
};

export const ChatVirtualList = ({
  chatRef,
  onUnreadBannerChange,
}: ChatVirtualListProps) => {
  const { t } = useTranslation();
  const {
    messages,
    authorsById,
    hasOlder,
    hasNewer,
    isAtLiveEnd,
    isFetchingOlder,
    isFetchingNewer,
    isInitialLoading,
    firstItemIndex,
    windowVersion,
    windowAnchorId,
    fetchOlder,
    fetchNewer,
    openAround,
  } = useChatMessages(chatRef);
  const unread = useMainTimelineUnread(chatRef, messages);
  const chatKey = `${chatRef.accountId}:${chatRef.chatId}`;
  const lastMessage = messages[messages.length - 1];
  const initialWindowIndex = windowAnchorId
    ? messages.findIndex((message) => message.id === windowAnchorId)
    : -1;

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const messagesRef = useRef(messages);
  const previousChatRef = useRef(chatRef);
  const previousAppendState = useRef({
    chatKey,
    windowVersion,
    messageCount: messages.length,
    lastMessageId: lastMessage?.id ?? null,
  });
  const atBottomRef = useRef(true);
  const isAtLiveEndRef = useRef(isAtLiveEnd);
  const shouldStickToBottomRef = useRef(false);
  const hasUserInteractedRef = useRef(false);
  const pendingScrollRaf = useRef<number | null>(null);
  const visibilityRafRef = useRef<number | null>(null);
  const visibilityTimerRef = useRef<number | null>(null);
  const readDwellTimerRef = useRef<number | null>(null);
  const [unreadViewportState, setUnreadViewportState] =
    useState<UnreadViewportState>("unknown");
  const [unreadSeparator, setUnreadSeparator] =
    useState<UnreadSeparatorState | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const unreadSeparatorEventId =
    unreadSeparator?.chatKey === chatKey ? unreadSeparator.eventId : null;

  messagesRef.current = messages;
  isAtLiveEndRef.current = isAtLiveEnd;

  const cancelReadDwell = useCallback(() => {
    if (readDwellTimerRef.current !== null) {
      window.clearTimeout(readDwellTimerRef.current);
      readDwellTimerRef.current = null;
    }
  }, []);

  const releaseHiddenSeparatorOutsideViewport = useCallback(() => {
    const scroller = scrollerRef.current;
    if (
      !scroller ||
      !unreadSeparator ||
      unreadSeparator.chatKey !== chatKey ||
      unreadSeparator.isVisible
    ) {
      return;
    }
    const separatorRow = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-chat-message-id]"),
    ).find((row) => row.dataset.chatMessageId === unreadSeparator.eventId);
    const viewport = scroller.getBoundingClientRect();
    const bounds = separatorRow?.getBoundingClientRect();
    if (!bounds || bounds.top >= viewport.bottom) {
      setUnreadSeparator((current) =>
        current?.chatKey === chatKey &&
        current.eventId === unreadSeparator.eventId &&
        !current.isVisible
          ? null
          : current,
      );
    }
  }, [chatKey, unreadSeparator]);

  const measureVisibleMessages = useCallback(() => {
    cancelReadDwell();
    releaseHiddenSeparatorOutsideViewport();
    const scroller = scrollerRef.current;
    const isFocused =
      document.visibilityState === "visible" && document.hasFocus();
    if (!scroller || unread.isLoading || !unread.hasUnread) {
      setUnreadViewportState("unknown");
      return;
    }
    if (!isFocused) {
      return;
    }

    const viewport = scroller.getBoundingClientRect();
    const visibleIds = new Set<string>();
    scroller
      .querySelectorAll<HTMLElement>("[data-chat-message-id]")
      .forEach((row) => {
        const bounds = row.getBoundingClientRect();
        const visibleHeight = Math.max(
          0,
          Math.min(bounds.bottom, viewport.bottom) -
            Math.max(bounds.top, viewport.top),
        );
        const requiredHeight =
          Math.min(bounds.height, viewport.height) * MESSAGE_VISIBILITY_RATIO;
        if (visibleHeight > 0 && visibleHeight >= requiredHeight) {
          const eventId = row.dataset.chatMessageId;
          if (eventId) {
            visibleIds.add(eventId);
          }
        }
      });

    const areAllUnreadVisible = unread.areAllUnreadVisible(
      visibleIds,
      hasNewer,
    );
    setUnreadViewportState(
      areAllUnreadVisible ? "all-visible" : "needs-navigation",
    );
    if (visibleIds.size === 0) {
      return;
    }

    // A focused dwell distinguishes content that is actually readable from
    // rows merely rendered by Virtuoso during navigation or layout settling.
    readDwellTimerRef.current = window.setTimeout(() => {
      readDwellTimerRef.current = null;
      if (document.visibilityState === "visible" && document.hasFocus()) {
        unread.markVisibleMessages(visibleIds, hasNewer);
      }
    }, READ_DWELL_MS);
  }, [
    cancelReadDwell,
    hasNewer,
    releaseHiddenSeparatorOutsideViewport,
    unread.areAllUnreadVisible,
    unread.hasUnread,
    unread.isLoading,
    unread.markVisibleMessages,
  ]);

  const scheduleVisibilityMeasurement = useCallback(() => {
    cancelReadDwell();
    if (visibilityTimerRef.current !== null) {
      window.clearTimeout(visibilityTimerRef.current);
    }
    visibilityTimerRef.current = window.setTimeout(() => {
      visibilityTimerRef.current = null;
      if (visibilityRafRef.current !== null) {
        cancelAnimationFrame(visibilityRafRef.current);
      }
      visibilityRafRef.current = requestAnimationFrame(() => {
        visibilityRafRef.current = null;
        measureVisibleMessages();
      });
    }, VISIBILITY_SETTLE_MS);
  }, [cancelReadDwell, measureVisibleMessages]);

  useEffect(() => {
    hasUserInteractedRef.current = false;
    atBottomRef.current = true;
    setUnreadViewportState("unknown");
    return () => {
      if (visibilityTimerRef.current !== null) {
        window.clearTimeout(visibilityTimerRef.current);
        visibilityTimerRef.current = null;
      }
      if (visibilityRafRef.current !== null) {
        cancelAnimationFrame(visibilityRafRef.current);
        visibilityRafRef.current = null;
      }
      cancelReadDwell();
    };
  }, [cancelReadDwell, chatKey, windowVersion]);

  useEffect(() => {
    const updateDocumentFocus = () => {
      const isFocused =
        document.visibilityState === "visible" && document.hasFocus();
      if (isFocused) {
        scheduleVisibilityMeasurement();
      } else {
        // Focus gates read acknowledgement, not navigation visibility. Keep an
        // already useful shortcut stable while the user visits another tab.
        cancelReadDwell();
      }
    };

    updateDocumentFocus();
    window.addEventListener("focus", updateDocumentFocus);
    window.addEventListener("blur", updateDocumentFocus);
    document.addEventListener("visibilitychange", updateDocumentFocus);
    return () => {
      window.removeEventListener("focus", updateDocumentFocus);
      window.removeEventListener("blur", updateDocumentFocus);
      document.removeEventListener("visibilitychange", updateDocumentFocus);
    };
  }, [cancelReadDwell, scheduleVisibilityMeasurement]);

  // Keep the last boundary mounted while it fades. Its slot is released only
  // when doing so cannot shift the visible rows below it.
  useEffect(() => {
    const eventId = unread.isLoading ? null : unread.firstUnreadId;
    setUnreadSeparator((current) => {
      if (eventId) {
        if (
          current?.chatKey === chatKey &&
          current.eventId === eventId &&
          current.isVisible
        ) {
          return current;
        }
        return { chatKey, eventId, isVisible: true };
      }
      if (current?.chatKey !== chatKey) {
        return null;
      }
      return current.isVisible ? { ...current, isVisible: false } : current;
    });
  }, [chatKey, unread.firstUnreadId, unread.isLoading]);

  useEffect(() => {
    if (!isInitialLoading) {
      scheduleVisibilityMeasurement();
    }
  }, [
    chatKey,
    hasNewer,
    isInitialLoading,
    messages.length,
    scheduleVisibilityMeasurement,
    unread.firstUnreadId,
    unread.hasUnread,
    unread.isLoading,
    windowVersion,
  ]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const markInteraction = () => {
      hasUserInteractedRef.current = true;
      scheduleVisibilityMeasurement();
    };
    const onScroll = () => scheduleVisibilityMeasurement();
    scroller.addEventListener("wheel", markInteraction, { passive: true });
    scroller.addEventListener("touchstart", markInteraction, { passive: true });
    scroller.addEventListener("pointerdown", markInteraction, {
      passive: true,
    });
    scroller.addEventListener("keydown", markInteraction);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("wheel", markInteraction);
      scroller.removeEventListener("touchstart", markInteraction);
      scroller.removeEventListener("pointerdown", markInteraction);
      scroller.removeEventListener("keydown", markInteraction);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [chatKey, scheduleVisibilityMeasurement, windowVersion]);

  const [skeletonState, setSkeletonState] = useState<SkeletonState>(() =>
    isInitialLoading ? "visible" : "hidden",
  );

  useEffect(() => {
    if (isInitialLoading) {
      setSkeletonState("visible");
      return;
    }
    const raf = requestAnimationFrame(() => {
      setSkeletonState((current) =>
        current === "visible" ? "leaving" : current,
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [isInitialLoading]);

  useEffect(() => {
    if (
      previousChatRef.current.accountId === chatRef.accountId &&
      previousChatRef.current.chatId === chatRef.chatId
    ) {
      return;
    }
    previousChatRef.current = chatRef;
    pendingScrollRaf.current = requestAnimationFrame(() => {
      pendingScrollRaf.current = requestAnimationFrame(() => {
        pendingScrollRaf.current = null;
        virtuosoRef.current?.scrollToIndex({
          index: "LAST",
          align: "end",
          behavior: "auto",
        });
      });
    });
    return () => {
      if (pendingScrollRaf.current !== null) {
        cancelAnimationFrame(pendingScrollRaf.current);
        pendingScrollRaf.current = null;
      }
    };
  }, [chatRef]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: "LAST",
      align: "end",
      behavior: "auto",
    });
  }, []);

  const scrollToEvent = useCallback((eventId: string) => {
    if (pendingScrollRaf.current !== null) {
      cancelAnimationFrame(pendingScrollRaf.current);
    }
    pendingScrollRaf.current = requestAnimationFrame(() => {
      pendingScrollRaf.current = requestAnimationFrame(() => {
        pendingScrollRaf.current = null;
        const arrayIndex = messagesRef.current.findIndex(
          (message) => message.id === eventId,
        );
        if (arrayIndex < 0) {
          return;
        }
        virtuosoRef.current?.scrollToIndex({
          // Virtuoso's imperative index is relative to `data` even when
          // `itemContent` receives the offset virtual index. Matrix identity
          // is resolved first; the array position is only the final UI hop.
          index: arrayIndex,
          align: "center",
          behavior: "auto",
        });
      });
    });
  }, []);

  const handleNavigateToUnread = useCallback(async () => {
    const eventId = unread.firstUnreadId;
    if (!eventId || isNavigating) {
      return;
    }
    // Programmatic navigation exposes the target, but the focused dwell still
    // has to confirm that it remained readable in the real viewport.
    hasUserInteractedRef.current = false;
    setUnreadViewportState("unknown");
    setIsNavigating(true);
    try {
      if (!messagesRef.current.some((message) => message.id === eventId)) {
        await openAround(eventId);
      }
      scrollToEvent(eventId);
    } finally {
      setIsNavigating(false);
    }
  }, [isNavigating, openAround, scrollToEvent, unread.firstUnreadId]);

  const navigateToUnread = useCallback(() => {
    void handleNavigateToUnread();
  }, [handleNavigateToUnread]);

  // `unknown` deliberately renders nothing: waiting for Virtuoso to settle
  // avoids flashing a shortcut before proving whether every unread is visible.
  const shouldShowUnreadBanner =
    unread.hasUnread && unreadViewportState === "needs-navigation";

  // Publish the controls to ChatView because the list owns their callbacks,
  // while Figma places the rendered banner inside the composer stack.
  useEffect(() => {
    onUnreadBannerChange(
      chatKey,
      shouldShowUnreadBanner
        ? {
            count: unread.unreadCount,
            canNavigate: unread.firstUnreadId !== null,
            isResolving: unread.isResolving || isNavigating,
            onNavigate: navigateToUnread,
            onMarkAllRead: unread.markAllRead,
          }
        : null,
    );
  }, [
    chatKey,
    isNavigating,
    navigateToUnread,
    onUnreadBannerChange,
    unread.firstUnreadId,
    unread.isResolving,
    unread.markAllRead,
    unread.unreadCount,
    shouldShowUnreadBanner,
  ]);

  useEffect(
    () => () => onUnreadBannerChange(chatKey, null),
    [chatKey, onUnreadBannerChange],
  );

  const handleAtTopStateChange = useCallback(
    (atTop: boolean) => {
      if (atTop && hasOlder && hasUserInteractedRef.current) {
        fetchOlder();
      }
    },
    [fetchOlder, hasOlder],
  );

  const handleEndReached = useCallback(() => {
    if (hasUserInteractedRef.current) {
      fetchNewer();
    }
  }, [fetchNewer]);

  useLayoutEffect(() => {
    const previous = previousAppendState.current;
    const isSameWindow =
      previous.chatKey === chatKey && previous.windowVersion === windowVersion;
    const didAppendLatest =
      messages.length > previous.messageCount &&
      lastMessage?.id !== previous.lastMessageId;
    const shouldFollowAppend =
      isAtLiveEnd && (atBottomRef.current || lastMessage?.authorId === "me");
    previousAppendState.current = {
      chatKey,
      windowVersion,
      messageCount: messages.length,
      lastMessageId: lastMessage?.id ?? null,
    };

    if (!isSameWindow || !didAppendLatest || !shouldFollowAppend) {
      return;
    }
    shouldStickToBottomRef.current = true;
    scrollToBottom();
  }, [
    chatKey,
    isAtLiveEnd,
    lastMessage?.authorId,
    lastMessage?.id,
    messages.length,
    scrollToBottom,
    windowVersion,
  ]);

  return (
    <div className="hub__chat-conversation__list">
      {!isInitialLoading && (
        <Virtuoso
          key={`${chatKey}:${windowVersion}`}
          ref={virtuosoRef}
          scrollerRef={(element) => {
            scrollerRef.current =
              element instanceof HTMLElement ? element : null;
          }}
          data={messages}
          firstItemIndex={firstItemIndex}
          computeItemKey={(_index, message) => message.id}
          defaultItemHeight={DEFAULT_ITEM_HEIGHT}
          initialTopMostItemIndex={
            initialWindowIndex >= 0
              ? { index: initialWindowIndex, align: "center" }
              : Math.max(0, messages.length - 1)
          }
          followOutput={isAtLiveEnd ? "auto" : false}
          atTopStateChange={handleAtTopStateChange}
          atBottomStateChange={(atBottom) => {
            atBottomRef.current = atBottom;
            if (atBottom && isAtLiveEndRef.current) {
              shouldStickToBottomRef.current = false;
            }
            scheduleVisibilityMeasurement();
          }}
          rangeChanged={scheduleVisibilityMeasurement}
          totalListHeightChanged={() => {
            if (shouldStickToBottomRef.current && isAtLiveEndRef.current) {
              scrollToBottom();
            }
            scheduleVisibilityMeasurement();
          }}
          endReached={hasNewer ? handleEndReached : undefined}
          increaseViewportBy={{ top: 400, bottom: 0 }}
          components={{
            Header: () => (
              <div className="hub__chat-conversation__top-spacer">
                {isFetchingOlder && (
                  <div
                    className="hub__chat-conversation__top-loader"
                    role="status"
                  >
                    <span className="material-icons" aria-hidden="true">
                      sync
                    </span>
                    {t("Loading older messages…")}
                  </div>
                )}
              </div>
            ),
            Footer: () => (
              <div className="hub__chat-conversation__bottom-spacer">
                {isFetchingNewer && (
                  <div
                    className="hub__chat-conversation__bottom-loader"
                    role="status"
                  >
                    <span className="material-icons" aria-hidden="true">
                      sync
                    </span>
                    {t("Loading newer messages…")}
                  </div>
                )}
              </div>
            ),
          }}
          itemContent={(virtualIndex, message) => {
            const arrayIndex = virtualIndex - firstItemIndex;
            const hasSeparator = message.id === unreadSeparatorEventId;
            return (
              <Row
                message={message}
                chatRef={chatRef}
                prev={hasSeparator ? undefined : messages[arrayIndex - 1]}
                next={
                  messages[arrayIndex + 1]?.id === unreadSeparatorEventId
                    ? undefined
                    : messages[arrayIndex + 1]
                }
                authorsById={authorsById}
                hasUnreadSeparator={hasSeparator}
                isUnreadSeparatorVisible={
                  hasSeparator && unreadSeparator?.isVisible === true
                }
              />
            );
          }}
        />
      )}
      {skeletonState !== "hidden" && (
        <ChatConversationSkeleton
          leaving={skeletonState === "leaving"}
          onLeaveEnd={() =>
            setSkeletonState((current) =>
              current === "leaving" ? "hidden" : current,
            )
          }
        />
      )}
    </div>
  );
};

type RowProps = {
  message: ChatMessage;
  chatRef: ChatRef;
  prev: ChatMessage | undefined;
  next: ChatMessage | undefined;
  authorsById: Map<string, ChatMessageAuthor>;
  hasUnreadSeparator: boolean;
  isUnreadSeparatorVisible: boolean;
};

const Row = memo(function Row({
  message,
  chatRef,
  prev,
  next,
  authorsById,
  hasUnreadSeparator,
  isUnreadSeparatorVisible,
}: RowProps) {
  const isSent = message.authorId === "me";
  const isFirstOfGroup =
    !prev ||
    prev.authorId !== message.authorId ||
    !isSameChatDay(prev.timestamp, message.timestamp);
  const isLastOfGroup =
    !next ||
    next.authorId !== message.authorId ||
    !isSameChatDay(message.timestamp, next.timestamp);

  if (isSent) {
    return (
      <RowShell
        messageId={message.id}
        hasUnreadSeparator={hasUnreadSeparator}
        isUnreadSeparatorVisible={isUnreadSeparatorVisible}
      >
        <ChatBubble
          variant="sent"
          chatRef={chatRef}
          messageId={message.id}
          content={message.content}
          timestamp={message.timestamp}
          reactions={message.reactions}
          isDeleted={message.isDeleted}
          isEdited={message.isEdited}
          canEdit={message.canEdit}
          canDelete={message.canDelete}
          thread={message.thread}
          showTimestamp={isLastOfGroup}
        />
      </RowShell>
    );
  }

  const author = authorsById.get(message.authorId);
  if (!author) {
    return null;
  }
  return (
    <RowShell
      messageId={message.id}
      hasUnreadSeparator={hasUnreadSeparator}
      isUnreadSeparatorVisible={isUnreadSeparatorVisible}
    >
      <ChatBubble
        variant="received"
        chatRef={chatRef}
        messageId={message.id}
        content={message.content}
        author={author}
        timestamp={message.timestamp}
        reactions={message.reactions}
        isDeleted={message.isDeleted}
        isEdited={message.isEdited}
        canEdit={message.canEdit}
        canDelete={message.canDelete}
        thread={message.thread}
        showHeader={isFirstOfGroup}
        showAvatar={isLastOfGroup}
      />
    </RowShell>
  );
});

const RowShell = ({
  children,
  messageId,
  hasUnreadSeparator,
  isUnreadSeparatorVisible,
}: {
  children: React.ReactNode;
  messageId: string;
  hasUnreadSeparator: boolean;
  isUnreadSeparatorVisible: boolean;
}) => (
  <div className="hub__chat-conversation__row" data-chat-message-id={messageId}>
    <div className="hub__chat-conversation__row-inner">
      {hasUnreadSeparator && (
        <UnreadSeparator visible={isUnreadSeparatorVisible} />
      )}
      {children}
    </div>
  </div>
);
