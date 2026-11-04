import {
  memo,
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

import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatRef,
} from "@/features/drivers/types";

import {
  type ChatMessageJump,
  ChatMessageJumpProvider,
  focusJumpTarget,
} from "../ChatMessageJumpContext";
import { isSameChatDay } from "../formatTimestamp";
import { useChatMessages } from "../hooks/useChatMessages";
import { useMainTimelineUnread } from "../hooks/useMainTimelineUnread";
import { useChatVisit } from "../hooks/useChatVisit";
import { useMarkedUnreadGate } from "../hooks/useMarkedUnreadGate";

import { ChatBubble } from "./ChatBubble";
import { ChatEncryptionNotice } from "./ChatEncryptionNotice";
import { ChatConversationSkeleton } from "./ChatConversationSkeleton";
import { JumpToLatestButton } from "./JumpToLatestButton";
import { UnreadSeparator } from "./UnreadSeparator";

type ChatVirtualListProps = {
  chatRef: ChatRef;
  /** Receives the list's jump to a message, `null` once it is gone. */
  onMessageJumpChange: (jump: ChatMessageJump | null) => void;
  /** Called by the jump to the latest messages, to focus the composer. */
  onJumpToLatest: () => void;
};

type TimelineContext = {
  chatRef: ChatRef;
  hasOlder: boolean;
  isFetchingOlder: boolean;
};

// Keep the header component stable across pagination updates; changing values
// arrive through Virtuoso's context rather than recreating the component type.
const TimelineHeader = ({ context }: { context?: TimelineContext }) => {
  const { t } = useTranslation();
  if (!context) return null;
  return (
    <>
      <div className="hub__chat-conversation__top-spacer">
        {context.isFetchingOlder && (
          <div className="hub__chat-conversation__top-loader" role="status">
            <span className="material-icons" aria-hidden="true">
              sync
            </span>
            {t("Loading older messages…")}
          </div>
        )}
      </div>
      {/* Show the notice at the start of available history, not every page. */}
      {!context.hasOlder && (
        <div className="hub__chat-conversation__row">
          <div className="hub__chat-conversation__row-inner">
            <ChatEncryptionNotice chatRef={context.chatRef} />
          </div>
        </div>
      )}
    </>
  );
};

const DEFAULT_ITEM_HEIGHT = 72;
// Request the previous page while this many rows remain above the rendered
// ones: it is then inserted off screen, where Virtuoso's estimated heights
// cannot move the messages being read.
const OLDER_PREFETCH_ROWS = 50;
// Debounce viewport checks until Virtuoso scrolling and layout have settled.
const VISIBILITY_SETTLE_MS = 150;
// After measuring, require focused visibility before marking a message read.
const READ_DWELL_MS = 250;
// Frames the backfill check waits for Virtuoso to render the first rows.
const FILL_CHECK_MAX_FRAMES = 10;
// A message qualifies as visible only when 60% of its rendered height is shown.
const MESSAGE_VISIBILITY_RATIO = 0.6;
// The first unread message opens below the 56px floating header, with the
// 8px gap `__top-spacer` also keeps.
const OPENING_TOP_OFFSET = 64;

type SkeletonState = "visible" | "leaving" | "hidden";

/**
 * Where the conversation opens. With unread messages, the window around the
 * first one loads behind the skeleton before the list shows, so it never opens
 * at the bottom and then jumps.
 */
type Opening =
  | { status: "resolving" }
  | { status: "loading" }
  | {
      status: "loaded";
      targetId: string | null;
      /** The target is the first unread message after this marker. */
      afterMarkerId: string | null;
    }
  | { status: "opened"; targetId: string | null; windowVersion: number };

export const ChatVirtualList = ({
  chatRef,
  onMessageJumpChange,
  onJumpToLatest,
}: ChatVirtualListProps) => {
  const { t } = useTranslation();
  const {
    messages,
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
  const unread = useMainTimelineUnread(chatRef, messages);
  const markedUnread = useMarkedUnreadGate(chatRef);
  const [opening, setOpening] = useState<Opening>({ status: "resolving" });
  const isListLoading = isInitialLoading || opening.status !== "opened";
  useChatVisit(chatRef, opening.status === "opened");
  // The separator stays before the message the visit opened on, even once
  // the conversation is read: like Element's read marker line, it shows
  // where this visit's unread messages started.
  const separatorEventId =
    opening.status === "opened" ? opening.targetId : null;
  const chatKey = `${chatRef.accountId}:${chatRef.chatId}`;
  const lastMessage = messages[messages.length - 1];
  const openingIndex =
    opening.status === "opened" &&
    opening.targetId &&
    opening.windowVersion === windowVersion
      ? messages.findIndex((message) => message.id === opening.targetId)
      : -1;
  const initialWindowIndex = windowAnchorId
    ? messages.findIndex((message) => message.id === windowAnchorId)
    : -1;

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const messagesRef = useRef(messages);
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
  const isReadOnOpeningRef = useRef(false);
  const isJumpingToLatestRef = useRef(false);
  const navigationRef = useRef<symbol | null>(null);
  const pendingScrollRaf = useRef<number | null>(null);
  const cancelJumpFocusRef = useRef<(() => void) | null>(null);
  const visibilityRafRef = useRef<number | null>(null);
  const visibilityTimerRef = useRef<number | null>(null);
  const readDwellTimerRef = useRef<number | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // As Element's highlighted event: selected until the next jump.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  messagesRef.current = messages;
  isAtLiveEndRef.current = isAtLiveEnd;

  // Like Element's jump to the read marker, a conversation with unread
  // messages opens on the first one, loading the window around it, or around
  // the read marker, when the latest messages do not hold it. A marker on an
  // event the timeline does not show, such as a reaction, opens on the next
  // message. Without unread messages, or a position for them (a thread
  // reply), the conversation opens at the bottom.
  useEffect(() => {
    if (
      opening.status !== "resolving" ||
      isInitialLoading ||
      unread.isLoading
    ) {
      return;
    }
    const firstUnreadId = unread.firstUnreadId;
    const markerId = unread.readUpToId;
    if (!unread.hasUnread || (!firstUnreadId && !markerId)) {
      setOpening({ status: "opened", targetId: null, windowVersion });
      return;
    }
    if (
      firstUnreadId &&
      messagesRef.current.some((message) => message.id === firstUnreadId)
    ) {
      setOpening({ status: "opened", targetId: firstUnreadId, windowVersion });
      return;
    }
    setOpening({ status: "loading" });
    const aroundId = (firstUnreadId ?? markerId) as string;
    void openAround(aroundId)
      .catch(() => null)
      .then((anchorId) => {
        const isAfterMarker = !firstUnreadId && anchorId === markerId;
        setOpening({
          status: "loaded",
          targetId: isAfterMarker ? null : anchorId,
          afterMarkerId: isAfterMarker ? markerId : null,
        });
      });
  }, [
    isInitialLoading,
    openAround,
    opening.status,
    unread.firstUnreadId,
    unread.hasUnread,
    unread.isLoading,
    unread.readUpToId,
    windowVersion,
  ]);

  // Open once the loaded window holds its target.
  useEffect(() => {
    if (opening.status !== "loaded" || isInitialLoading) {
      return;
    }
    const isLoaded = (eventId: string) =>
      messages.some((message) => message.id === eventId);
    if (opening.afterMarkerId) {
      if (isLoaded(opening.afterMarkerId)) {
        setOpening({
          status: "opened",
          targetId: unread.firstUnreadId,
          windowVersion,
        });
      }
      return;
    }
    if (!opening.targetId || isLoaded(opening.targetId)) {
      setOpening({
        status: "opened",
        targetId: opening.targetId,
        windowVersion,
      });
    }
  }, [
    isInitialLoading,
    messages,
    opening,
    unread.firstUnreadId,
    windowVersion,
  ]);

  // The whole conversation is read as soon as it shows, not only the messages
  // in view; threads keep their own unread replies. Before paint, so the jump
  // to the latest messages does not flash its new-message dot.
  useLayoutEffect(() => {
    if (opening.status !== "opened" || isReadOnOpeningRef.current) {
      return;
    }
    isReadOnOpeningRef.current = true;
    unread.markAllRead();
    if (markedUnread.isMarkedUnread) {
      markedUnread.clearIfAllowed();
    }
  }, [markedUnread, opening.status, unread]);

  const cancelReadDwell = useCallback(() => {
    if (readDwellTimerRef.current !== null) {
      window.clearTimeout(readDwellTimerRef.current);
      readDwellTimerRef.current = null;
    }
  }, []);

  // A focused dwell distinguishes content that is actually readable from
  // rows merely rendered by Virtuoso during navigation or layout settling.
  const startReadDwell = useCallback((read: () => void) => {
    readDwellTimerRef.current = window.setTimeout(() => {
      readDwellTimerRef.current = null;
      if (document.visibilityState === "visible" && document.hasFocus()) {
        read();
      }
    }, READ_DWELL_MS);
  }, []);

  // Messages received after the opening are read once they are seen.
  const measureVisibleMessages = useCallback(() => {
    cancelReadDwell();
    const scroller = scrollerRef.current;
    const isFocused =
      document.visibilityState === "visible" && document.hasFocus();
    const shouldClearMarkedUnread =
      markedUnread.isMarkedUnread && markedUnread.canClear();
    if (!unread.hasUnread) {
      // With no unread message, reading the timeline only clears the flag.
      if (shouldClearMarkedUnread && scroller && isFocused) {
        startReadDwell(markedUnread.clearIfAllowed);
      }
      return;
    }
    if (!scroller || unread.isLoading || !isFocused) {
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
    if (visibleIds.size === 0) {
      return;
    }

    startReadDwell(() => {
      unread.markVisibleMessages(visibleIds, hasNewer);
      if (shouldClearMarkedUnread) {
        markedUnread.clearIfAllowed();
      }
    });
  }, [
    cancelReadDwell,
    hasNewer,
    markedUnread,
    startReadDwell,
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
    setIsAtBottom(true);
    // Switching conversation already resets state by remounting this component.
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
        // Focus gates read acknowledgement.
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

  useEffect(() => {
    if (!isListLoading) {
      scheduleVisibilityMeasurement();
    }
  }, [
    chatKey,
    hasNewer,
    isListLoading,
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
      markedUnread.allowClear();
      shouldStickToBottomRef.current = false;
      // endReached can fire before the first interaction at a contextual end.
      // A new interaction there must still be able to request the next page.
      if (atBottomRef.current) {
        fetchNewer();
      }
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
  }, [
    chatKey,
    fetchNewer,
    isListLoading,
    markedUnread.allowClear,
    scheduleVisibilityMeasurement,
    windowVersion,
  ]);

  const [skeletonState, setSkeletonState] = useState<SkeletonState>(() =>
    isListLoading ? "visible" : "hidden",
  );

  useEffect(() => {
    if (isListLoading) {
      setSkeletonState("visible");
      return;
    }
    const raf = requestAnimationFrame(() => {
      setSkeletonState((current) =>
        current === "visible" ? "leaving" : current,
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [isListLoading]);

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
          targetId = await openAround(eventId).catch(() => null);
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
      openLatest();
    }
    onJumpToLatest();
  }, [onJumpToLatest, openLatest, scrollToBottom]);

  const isJumpToLatestShown = !isListLoading && !(isAtBottom && isAtLiveEnd);
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
      scheduleVisibilityMeasurement();
    },
    [fetchOlder, firstItemIndex, hasOlder, scheduleVisibilityMeasurement],
  );

  const handleEndReached = useCallback(() => {
    if (hasUserInteractedRef.current) {
      fetchNewer();
    }
  }, [fetchNewer]);

  // Like Element's ScrollPanel, backfill without waiting for a scroll while
  // the list holds less than one screen beyond its viewport: the first page
  // shows the messages already in memory, however few. Only on the latest
  // messages: a jump opens a complete window, nothing is added around it.
  // After a failed request, only a scroll asks again: requests are not
  // retried, so retrying here would loop while the server keeps failing.
  // Checked again whenever the list height changes, as Element does: a
  // reloaded window can first measure its previous rows, then shrink below
  // the viewport, where no scroll can ask for more.
  const fillIfShortRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (
      isListLoading ||
      !hasOlder ||
      isFetchingOlder ||
      isFetchOlderError ||
      !isAtLiveEnd ||
      windowAnchorId
    ) {
      return;
    }
    let raf = 0;
    let waitedFrames = 0;
    // Before its rows render, Virtuoso's height says nothing about them.
    const hasRows = () =>
      Boolean(scrollerRef.current?.querySelector("[data-chat-message-id]"));
    const fillIfShort = () => {
      const scroller = scrollerRef.current;
      if (
        scroller &&
        hasRows() &&
        scroller.scrollHeight < scroller.clientHeight * 2
      ) {
        fetchOlder();
      }
    };
    const checkFill = () => {
      if (!hasRows()) {
        if (waitedFrames < FILL_CHECK_MAX_FRAMES) {
          waitedFrames += 1;
          raf = requestAnimationFrame(checkFill);
        }
        return;
      }
      fillIfShort();
    };
    fillIfShortRef.current = fillIfShort;
    raf = requestAnimationFrame(checkFill);
    return () => {
      cancelAnimationFrame(raf);
      fillIfShortRef.current = () => {};
    };
  }, [
    fetchOlder,
    hasOlder,
    isAtLiveEnd,
    isFetchOlderError,
    isFetchingOlder,
    isListLoading,
    messages.length,
    windowAnchorId,
  ]);

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
    messages.length,
    scrollToBottom,
    windowVersion,
  ]);

  let initialTopMostItemIndex: IndexLocationWithAlign | number = Math.max(
    0,
    messages.length - 1,
  );
  if (openingIndex >= 0) {
    initialTopMostItemIndex = {
      index: openingIndex,
      align: "start",
      offset: -OPENING_TOP_OFFSET,
    };
  } else if (initialWindowIndex >= 0) {
    initialTopMostItemIndex = { index: initialWindowIndex, align: "center" };
  }

  return (
    <ChatMessageJumpProvider value={messageJump}>
      <div className="hub__chat-conversation__list">
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
              scheduleVisibilityMeasurement();
            }}
            rangeChanged={handleRangeChanged}
            totalListHeightChanged={() => {
              if (shouldStickToBottomRef.current && isAtLiveEndRef.current) {
                scrollToBottom();
              }
              fillIfShortRef.current();
              scheduleVisibilityMeasurement();
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
              const hasSeparator = message.id === separatorEventId;
              const next = messages[arrayIndex + 1];
              return (
                <Row
                  message={message}
                  chatRef={chatRef}
                  prev={hasSeparator ? undefined : messages[arrayIndex - 1]}
                  next={next?.id === separatorEventId ? undefined : next}
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
    </ChatMessageJumpProvider>
  );
};

type RowProps = {
  message: ChatMessage;
  chatRef: ChatRef;
  prev: ChatMessage | undefined;
  next: ChatMessage | undefined;
  authorsById: Map<string, ChatMessageAuthor>;
  hasUnreadSeparator: boolean;
  isHighlighted: boolean;
};

const Row = memo(function Row({
  message,
  chatRef,
  prev,
  next,
  authorsById,
  hasUnreadSeparator,
  isHighlighted,
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
        isFirstOfGroup={isFirstOfGroup}
        hasUnreadSeparator={hasUnreadSeparator}
      >
        <ChatBubble
          variant="sent"
          chatRef={chatRef}
          messageId={message.id}
          content={message.content}
          htmlContent={message.htmlContent}
          attachment={message.attachment}
          timestamp={message.timestamp}
          reactions={message.reactions}
          isDeleted={message.isDeleted}
          isEdited={message.isEdited}
          replyToId={message.replyToId}
          isHighlighted={isHighlighted}
          availability={message.availability}
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
      isFirstOfGroup={isFirstOfGroup}
      hasUnreadSeparator={hasUnreadSeparator}
    >
      <ChatBubble
        variant="received"
        chatRef={chatRef}
        messageId={message.id}
        content={message.content}
        htmlContent={message.htmlContent}
        attachment={message.attachment}
        author={author}
        timestamp={message.timestamp}
        reactions={message.reactions}
        isDeleted={message.isDeleted}
        isEdited={message.isEdited}
        replyToId={message.replyToId}
        isHighlighted={isHighlighted}
        availability={message.availability}
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
  isFirstOfGroup,
  hasUnreadSeparator,
}: {
  children: React.ReactNode;
  messageId: string;
  isFirstOfGroup: boolean;
  hasUnreadSeparator: boolean;
}) => (
  <div
    className="hub__chat-conversation__row"
    data-chat-message-id={messageId}
    data-group-start={isFirstOfGroup || undefined}
  >
    <div className="hub__chat-conversation__row-inner">
      {hasUnreadSeparator && <UnreadSeparator />}
      {children}
    </div>
  </div>
);
