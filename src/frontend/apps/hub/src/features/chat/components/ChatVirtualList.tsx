import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  type IndexLocationWithAlign,
  type ListRange,
  Virtuoso,
  type VirtuosoHandle,
} from "react-virtuoso";

import type { ChatRef } from "@/features/drivers/types";

import {
  type ChatMessageJump,
  ChatMessageJumpProvider,
  focusJumpTarget,
} from "../ChatMessageJumpContext";
import { useChatMessages } from "../hooks/useChatMessages";
import { useChatVisit } from "../hooks/useChatVisit";
import { useConversationOpening } from "../hooks/useConversationOpening";
import { useMessagesWithFailed } from "../hooks/useFailedMessages";
import { useMainTimelineUnread } from "../hooks/useMainTimelineUnread";
import { useMarkedUnreadGate } from "../hooks/useMarkedUnreadGate";
import { useReadAtLatest } from "../hooks/useReadAtLatest";
import { useTimelineBackfill } from "../hooks/useTimelineBackfill";

import { ChatConversationSkeleton } from "./ChatConversationSkeleton";
import { TimelineHeader } from "./ChatTimelineHeader";
import { ChatTimelineRow } from "./ChatTimelineRow";
import { JumpToLatestButton } from "./JumpToLatestButton";

type ChatVirtualListProps = {
  chatRef: ChatRef;
  /** Receives the list's jump to a message, `null` once it is gone. */
  onMessageJumpChange: (jump: ChatMessageJump | null) => void;
  /** Called by the jump to the latest messages, to focus the composer. */
  onJumpToLatest: () => void;
};

const DEFAULT_ITEM_HEIGHT = 72;
// Request the previous page while this many rows remain above the rendered
// ones: it is then inserted off screen, where Virtuoso's estimated heights
// cannot move the messages being read.
const OLDER_PREFETCH_ROWS = 50;
// The first unread message never opens higher than below the 56px floating
// header, with the 8px gap `__top-spacer` also keeps.
const OPENING_TOP_OFFSET = 64;
// Otherwise it opens a third of the way down the list, as Element opens on its
// read marker (`TimelinePanel`'s `offsetBase`).
const OPENING_HEIGHT_RATIO = 1 / 3;

export const ChatVirtualList = ({
  chatRef,
  onMessageJumpChange,
  onJumpToLatest,
}: ChatVirtualListProps) => {
  const { t } = useTranslation();
  const {
    messages: loadedMessages,
    authorsById,
    hasOlder,
    hasNewer,
    isAtLiveEnd,
    isFetchingOlder,
    isFetchOlderError,
    isFetchingNewer,
    isInitialLoading,
    firstItemIndex,
    windowVersion,
    windowAnchorId,
    fetchOlder,
    fetchNewer,
    openAround,
    openLatest,
  } = useChatMessages(chatRef);
  // As in Element, below the others: where they land if sent again.
  const messages = useMessagesWithFailed(chatRef, undefined, loadedMessages, {
    isEnabled: isAtLiveEnd,
  });
  const unread = useMainTimelineUnread(chatRef);
  const markedUnread = useMarkedUnreadGate(chatRef);
  // The server does not know a failed message: it cannot be read through. They
  // come after the loaded messages, so the opening index holds for the list.
  const { isOpened, openedOnId, openingIndex } = useConversationOpening({
    messages: loadedMessages,
    isInitialLoading,
    windowVersion,
    openAround,
    openLatest,
    unread,
    markedUnread,
  });
  const isListLoading = isInitialLoading || !isOpened;
  useChatVisit(chatRef, isOpened);

  const chatKey = `${chatRef.accountId}:${chatRef.chatId}`;
  // The latest message the server knows: a failed one stays below it, and can
  // neither be read through nor tell that a new message arrived.
  const lastMessage = loadedMessages[loadedMessages.length - 1];

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const messagesRef = useRef(messages);
  const previousAppendState = useRef({
    chatKey,
    windowVersion,
    messageCount: loadedMessages.length,
    lastMessageId: lastMessage?.id ?? null,
  });
  const atBottomRef = useRef(true);
  const isAtLiveEndRef = useRef(isAtLiveEnd);
  const shouldStickToBottomRef = useRef(false);
  const hasUserInteractedRef = useRef(false);
  const isJumpingToLatestRef = useRef(false);
  const navigationRef = useRef<symbol | null>(null);
  const pendingScrollRaf = useRef<number | null>(null);
  const cancelJumpFocusRef = useRef<(() => void) | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // As Element's highlighted event: selected until the next jump.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  messagesRef.current = messages;
  isAtLiveEndRef.current = isAtLiveEnd;

  const isAtLatest = isAtBottom && isAtLiveEnd;
  useReadAtLatest({
    isOpened,
    isAtLatest,
    lastLoadedId: loadedMessages.at(-1)?.id,
    unread,
    markedUnread,
  });

  useEffect(() => {
    hasUserInteractedRef.current = false;
    atBottomRef.current = true;
    setIsAtBottom(true);
  }, [windowVersion]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const markInteraction = () => {
      hasUserInteractedRef.current = true;
      markedUnread.allowClear();
      shouldStickToBottomRef.current = false;
      // endReached can fire before the first interaction at a contextual end.
      // A new interaction there must still be able to request the next page.
      if (atBottomRef.current) {
        fetchNewer();
      }
    };
    scroller.addEventListener("wheel", markInteraction, { passive: true });
    scroller.addEventListener("touchstart", markInteraction, { passive: true });
    scroller.addEventListener("pointerdown", markInteraction, {
      passive: true,
    });
    scroller.addEventListener("keydown", markInteraction);
    return () => {
      scroller.removeEventListener("wheel", markInteraction);
      scroller.removeEventListener("touchstart", markInteraction);
      scroller.removeEventListener("pointerdown", markInteraction);
      scroller.removeEventListener("keydown", markInteraction);
    };
  }, [fetchNewer, isListLoading, markedUnread.allowClear, windowVersion]);

  useEffect(
    () => () => {
      navigationRef.current = null;
      if (pendingScrollRaf.current !== null) {
        cancelAnimationFrame(pendingScrollRaf.current);
        pendingScrollRaf.current = null;
      }
      cancelJumpFocusRef.current?.();
    },
    [],
  );

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

  // Like Element's click on a reply's quote: open the window around the
  // quoted message when the list does not hold it, then show it highlighted.
  const jumpToMessage = useCallback(
    async (eventId: string) => {
      if (navigationRef.current) {
        return;
      }
      const navigation = Symbol();
      navigationRef.current = navigation;
      // The scroll it makes is not the user's, which would load older
      // messages above the target.
      hasUserInteractedRef.current = false;
      shouldStickToBottomRef.current = false;
      try {
        let targetId: string | null = eventId;
        if (!messagesRef.current.some((message) => message.id === eventId)) {
          const opened = await openAround(eventId).catch(() => null);
          targetId = opened?.anchorId ?? null;
        }
        if (!targetId || navigationRef.current !== navigation) {
          return;
        }
        scrollToEvent(targetId);
        setHighlightedId(targetId);
        cancelJumpFocusRef.current?.();
        cancelJumpFocusRef.current = focusJumpTarget(
          () => scrollerRef.current,
          targetId,
        );
      } finally {
        if (navigationRef.current === navigation) {
          navigationRef.current = null;
        }
      }
    },
    [openAround, scrollToEvent],
  );
  const messageJump = useMemo<ChatMessageJump>(
    () => ({ jumpTo: jumpToMessage, loadsMissing: true }),
    [jumpToMessage],
  );
  // A thread's quote of a conversation message jumps here too.
  useEffect(() => {
    onMessageJumpChange(messageJump);
    return () => onMessageJumpChange(null);
  }, [messageJump, onMessageJumpChange]);

  // Like Element's `RoomView.jumpToLiveTimeline`: scroll down when the window
  // reaches the live end, reload the latest messages otherwise, then focus the
  // composer.
  const jumpToLatest = useCallback(() => {
    navigationRef.current = null;
    cancelJumpFocusRef.current?.();
    setHighlightedId(null);
    isJumpingToLatestRef.current = true;
    if (isAtLiveEndRef.current) {
      shouldStickToBottomRef.current = true;
      scrollToBottom();
    } else {
      void openLatest();
    }
    onJumpToLatest();
  }, [onJumpToLatest, openLatest, scrollToBottom]);

  const isJumpToLatestShown = !isListLoading && !isAtLatest;
  // The button goes away once at the bottom, and a composer that is blocked
  // does not take the focus: it stays in the conversation, not on the page.
  useEffect(() => {
    if (!isJumpingToLatestRef.current || isListLoading || isJumpToLatestShown) {
      return;
    }
    isJumpingToLatestRef.current = false;
    if (document.activeElement === document.body) {
      scrollerRef.current?.focus({ preventScroll: true });
    }
  }, [isJumpToLatestShown, isListLoading]);

  const handleAtTopStateChange = useCallback(
    (atTop: boolean) => {
      if (atTop && hasOlder && hasUserInteractedRef.current) {
        fetchOlder();
      }
    },
    [fetchOlder, hasOlder],
  );

  const handleRangeChanged = useCallback(
    ({ startIndex }: ListRange) => {
      if (
        hasOlder &&
        hasUserInteractedRef.current &&
        startIndex - firstItemIndex < OLDER_PREFETCH_ROWS
      ) {
        fetchOlder();
      }
    },
    [fetchOlder, firstItemIndex, hasOlder],
  );

  const handleEndReached = useCallback(() => {
    if (hasUserInteractedRef.current) {
      fetchNewer();
    }
  }, [fetchNewer]);

  const fillIfShort = useTimelineBackfill({
    scrollerRef,
    isEnabled:
      !isListLoading &&
      hasOlder &&
      !isFetchingOlder &&
      !isFetchOlderError &&
      isAtLiveEnd &&
      !windowAnchorId,
    messageCount: messages.length,
    fetchOlder,
  });

  useLayoutEffect(() => {
    const previous = previousAppendState.current;
    const isSameWindow =
      previous.chatKey === chatKey && previous.windowVersion === windowVersion;
    const didAppendLatest =
      loadedMessages.length > previous.messageCount &&
      lastMessage?.id !== previous.lastMessageId;
    const shouldFollowAppend =
      isAtLiveEnd && (atBottomRef.current || lastMessage?.authorId === "me");
    previousAppendState.current = {
      chatKey,
      windowVersion,
      messageCount: loadedMessages.length,
      lastMessageId: lastMessage?.id ?? null,
    };

    // The first page arriving while the list opens is not an append: following
    // it would stick the list to the bottom instead of its first unread message.
    if (
      isListLoading ||
      !isSameWindow ||
      !didAppendLatest ||
      !shouldFollowAppend
    ) {
      return;
    }
    shouldStickToBottomRef.current = true;
    scrollToBottom();
  }, [
    chatKey,
    isAtLiveEnd,
    isListLoading,
    lastMessage?.authorId,
    lastMessage?.id,
    loadedMessages.length,
    scrollToBottom,
    windowVersion,
  ]);

  const windowAnchorIndex = windowAnchorId
    ? messages.findIndex((message) => message.id === windowAnchorId)
    : -1;
  let initialTopMostItemIndex: IndexLocationWithAlign | number = Math.max(
    0,
    messages.length - 1,
  );
  if (openingIndex >= 0) {
    // Read when the list mounts, the only time Virtuoso uses it: the list
    // container is there since the loading state.
    const listHeight = listRef.current?.clientHeight ?? 0;
    initialTopMostItemIndex = {
      index: openingIndex,
      align: "start",
      offset: -Math.max(
        OPENING_TOP_OFFSET,
        Math.round(listHeight * OPENING_HEIGHT_RATIO),
      ),
    };
  } else if (windowAnchorIndex >= 0) {
    initialTopMostItemIndex = { index: windowAnchorIndex, align: "center" };
  }

  return (
    <ChatMessageJumpProvider value={messageJump}>
      <div ref={listRef} className="hub__chat-conversation__list">
        {!isListLoading && (
          <Virtuoso
            key={`${chatKey}:${windowVersion}`}
            ref={virtuosoRef}
            scrollerRef={(element) => {
              scrollerRef.current =
                element instanceof HTMLElement ? element : null;
            }}
            data={messages}
            context={{ chatRef, hasOlder, isFetchingOlder }}
            firstItemIndex={firstItemIndex}
            computeItemKey={(_index, message) => message.id}
            defaultItemHeight={DEFAULT_ITEM_HEIGHT}
            // Measure rows before paint. By default Virtuoso waits a frame, so a
            // row rendered above the viewport first shifts the visible ones by
            // its estimation error. This may log benign "ResizeObserver loop"
            // errors.
            skipAnimationFrameInResizeObserver
            initialTopMostItemIndex={initialTopMostItemIndex}
            followOutput={isAtLiveEnd ? "auto" : false}
            // A short conversation sits above the composer, as in Element:
            // backfilled history then appears above it instead of moving it.
            alignToBottom
            atTopStateChange={handleAtTopStateChange}
            atBottomStateChange={(atBottom) => {
              atBottomRef.current = atBottom;
              setIsAtBottom(atBottom);
              if (atBottom && isAtLiveEndRef.current) {
                shouldStickToBottomRef.current = false;
              }
            }}
            rangeChanged={handleRangeChanged}
            totalListHeightChanged={() => {
              if (shouldStickToBottomRef.current && isAtLiveEndRef.current) {
                scrollToBottom();
              }
              fillIfShort();
            }}
            endReached={hasNewer ? handleEndReached : undefined}
            increaseViewportBy={{ top: 400, bottom: 0 }}
            components={{
              Header: TimelineHeader,
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
              const hasSeparator = message.id === openedOnId;
              const next = messages[arrayIndex + 1];
              return (
                <ChatTimelineRow
                  message={message}
                  chatRef={chatRef}
                  prev={hasSeparator ? undefined : messages[arrayIndex - 1]}
                  next={next?.id === openedOnId ? undefined : next}
                  authorsById={authorsById}
                  hasUnreadSeparator={hasSeparator}
                  isHighlighted={message.id === highlightedId}
                />
              );
            }}
          />
        )}
        {/* Like Element's jump to bottom, shown away from the latest messages:
        a dot stands for the messages received since the conversation was
        read, where Element counts them. */}
        {isJumpToLatestShown && (
          <JumpToLatestButton
            hasNewMessages={unread.hasUnread}
            onClick={jumpToLatest}
          />
        )}
        <ChatConversationSkeleton isLoading={isListLoading} />
      </div>
    </ChatMessageJumpProvider>
  );
};
