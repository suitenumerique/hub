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
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatRef,
} from "@/features/drivers/types";

import { useChatMessages } from "../hooks/useChatMessages";
import { useChatUnreadState } from "../hooks/useChatUnread";
import { useMarkChatRead } from "../hooks/useMarkChatRead";

import { ChatBubble } from "./ChatBubble";
import { ChatConversationSkeleton } from "./ChatConversationSkeleton";
import { UnreadSeparator } from "./UnreadSeparator";

type ChatVirtualListProps = {
  chatRef: ChatRef;
  onUnreadNavigationChange?: (
    navigation: MainTimelineUnreadNavigation | null,
  ) => void;
};

export type MainTimelineUnreadNavigation = {
  count: number | null;
  status: "unresolved" | "resolved" | "unavailable";
  isOpening: boolean;
  isMarkingRead: boolean;
  open: () => void;
  markRead: () => void;
};

const DEFAULT_ITEM_HEIGHT = 72;
const MARK_READ_DEBOUNCE_MS = 500;
const MARK_READ_RETRY_MAX_MS = 8000;
const UNREAD_SCROLL_FALLBACK_MS = 1200;

type SkeletonState = "visible" | "leaving" | "hidden";

type PendingReadProgress = {
  chatKey: string;
  messageId: string;
  clearBoundary: boolean;
};

type InFlightReadProgress = PendingReadProgress & {
  countBaseline: {
    count: number | null;
    matrixCount: number | null;
  };
};

type ReadTrackingSnapshot = {
  chatKey: string;
  liveEndEnabled: boolean;
  partialEnabled: boolean;
  firstUnreadIndex: number;
  messages: ChatMessage[];
  messageIndexById: Map<string, number>;
};

type DisplayedUnreadCountState = {
  chatKey: string;
  count: number | null;
  matrixCount: number | null;
};

export const ChatVirtualList = ({
  chatRef,
  onUnreadNavigationChange,
}: ChatVirtualListProps) => {
  const { t } = useTranslation();
  const chatKey = `${chatRef.accountId}:${chatRef.chatId}`;
  const { unread, isPending: isUnreadPending } = useChatUnreadState(chatRef);
  const isUnread = unread.unread;
  const {
    messages,
    authorsById,
    firstUnreadMessageId,
    anchorStatus,
    unreadAnchorStatus,
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
    anchor: "latest",
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
  const scrollerRef = useRef<HTMLElement | Window | null>(null);
  const [scrollerElement, setScrollerElement] = useState<HTMLElement | null>(
    null,
  );
  const previousAppendState = useRef({
    chatKey,
    messageCount: messages.length,
    lastMessageId: lastMessage?.id ?? null,
  });
  const atBottomRef = useRef(true);
  const shouldStickToBottomRef = useRef(false);
  const pendingScrollRaf = useRef<number | null>(null);
  const pendingScrollTimer = useRef<number | null>(null);
  const pendingBottomSyncRaf = useRef<number | null>(null);
  const pendingUnreadScrollTimer = useRef<number | null>(null);
  const pendingUnreadJumpRef = useRef(false);
  const unreadScrollAnimationRef = useRef(false);
  const unreadScrollStartedRef = useRef(false);
  const anchoredBottomStateReadyRef = useRef(false);
  const viewportReadRafRef = useRef<number | null>(null);
  const furthestReadMessageIdRef = useRef<string | null>(null);
  const lastCountedReadMessageIdRef = useRef<string | null>(null);
  const pendingReadProgressRef = useRef<PendingReadProgress | null>(null);
  const inFlightReadProgressRef = useRef<InFlightReadProgress | null>(null);
  const lastMarkedMessageIdRef = useRef<string | null>(null);
  const markReadTimerRef = useRef<number | null>(null);
  const markReadRetryCountRef = useRef(0);
  const flushReadProgressRef = useRef<() => void>(() => {});
  const [positionedChatKey, setPositionedChatKey] = useState<string | null>(
    null,
  );
  const [readTrackingReadyChatKey, setReadTrackingReadyChatKey] = useState<
    string | null
  >(null);
  const [unreadNavigationChatKey, setUnreadNavigationChatKey] = useState<
    string | null
  >(null);
  const [unreadJumpRequest, setUnreadJumpRequest] = useState(0);
  const [isJumpingToUnread, setIsJumpingToUnread] = useState(false);
  const [isOpeningFirstUnread, setIsOpeningFirstUnread] = useState(false);
  const [isMarkingMainRead, setIsMarkingMainRead] = useState(false);
  const [clearedBoundaryChatKey, setClearedBoundaryChatKey] = useState<
    string | null
  >(null);
  const matrixMainUnreadCount = unread.mainTimelineCount ?? null;
  const [displayedUnreadCountState, setDisplayedUnreadCountState] =
    useState<DisplayedUnreadCountState>(() => ({
      chatKey,
      count: matrixMainUnreadCount,
      matrixCount: matrixMainUnreadCount,
    }));
  const displayedUnreadCountStateRef = useRef(displayedUnreadCountState);
  displayedUnreadCountStateRef.current = displayedUnreadCountState;
  const displayedUnreadCount =
    displayedUnreadCountState.chatKey === chatKey
      ? displayedUnreadCountState.count
      : matrixMainUnreadCount;
  const readTrackingRef = useRef<ReadTrackingSnapshot>({
    chatKey,
    liveEndEnabled: false,
    partialEnabled: false,
    firstUnreadIndex,
    messages,
    messageIndexById,
  });
  readTrackingRef.current = {
    chatKey,
    liveEndEnabled:
      isUnread &&
      positionedChatKey === chatKey &&
      readTrackingReadyChatKey === chatKey &&
      !isInitialLoading,
    partialEnabled:
      isUnread &&
      anchorStatus === "resolved" &&
      firstUnreadMessageId !== null &&
      unreadNavigationChatKey === chatKey &&
      positionedChatKey === chatKey &&
      readTrackingReadyChatKey === chatKey &&
      clearedBoundaryChatKey !== chatKey,
    firstUnreadIndex,
    messages,
    messageIndexById,
  };
  const markChatReadRef = useRef(markChatRead);
  markChatReadRef.current = markChatRead;
  const liveEndMessageRef = useRef<{
    chatKey: string;
    messageId: string | null;
  }>({ chatKey, messageId: null });
  if (liveEndMessageRef.current.chatKey !== chatKey) {
    liveEndMessageRef.current = { chatKey, messageId: null };
  }
  if (!hasNewer && lastMessage) {
    liveEndMessageRef.current.messageId = lastMessage.id;
  }

  const rememberReadProgress = useCallback(
    (messageId: string, clearBoundary: boolean): boolean => {
      const snapshot = readTrackingRef.current;
      if (clearBoundary ? !snapshot.liveEndEnabled : !snapshot.partialEnabled) {
        return false;
      }

      const nextIndex = snapshot.messageIndexById.get(messageId);
      if (
        nextIndex === undefined ||
        (!clearBoundary && nextIndex < snapshot.firstUnreadIndex)
      ) {
        return false;
      }
      if (lastMarkedMessageIdRef.current === messageId) {
        if (clearBoundary) {
          setClearedBoundaryChatKey(snapshot.chatKey);
        }
        return false;
      }
      const furthestId = furthestReadMessageIdRef.current;
      const furthestIndex = furthestId
        ? snapshot.messageIndexById.get(furthestId)
        : undefined;
      if (furthestIndex !== undefined && nextIndex < furthestIndex) {
        return false;
      }

      furthestReadMessageIdRef.current = messageId;
      const pending = pendingReadProgressRef.current;
      pendingReadProgressRef.current = {
        chatKey: snapshot.chatKey,
        messageId,
        clearBoundary:
          clearBoundary ||
          (pending?.messageId === messageId && pending.clearBoundary),
      };
      return true;
    },
    [],
  );

  const scheduleReadProgressFlush = useCallback(
    (delay = MARK_READ_DEBOUNCE_MS) => {
      if (markReadTimerRef.current !== null) {
        window.clearTimeout(markReadTimerRef.current);
      }
      markReadTimerRef.current = window.setTimeout(() => {
        markReadTimerRef.current = null;
        flushReadProgressRef.current();
      }, delay);
    },
    [],
  );

  const commitDisplayedReadProgress = useCallback(
    (
      messageId: string,
      clearBoundary: boolean,
      countBaseline?: InFlightReadProgress["countBaseline"],
    ) => {
      const snapshot = readTrackingRef.current;
      if (clearBoundary) {
        lastCountedReadMessageIdRef.current = messageId;
        setDisplayedUnreadCountState((current) =>
          current.chatKey === snapshot.chatKey
            ? { ...current, count: 0 }
            : current,
        );
        return;
      }

      const targetIndex = snapshot.messageIndexById.get(messageId);
      if (targetIndex === undefined) {
        return;
      }

      const previousMessageId = lastCountedReadMessageIdRef.current;
      const previousIndex = previousMessageId
        ? snapshot.messageIndexById.get(previousMessageId)
        : undefined;
      if (previousMessageId && previousIndex === undefined) {
        return;
      }
      if (previousIndex !== undefined && targetIndex <= previousIndex) {
        return;
      }

      const startIndex =
        previousIndex === undefined
          ? snapshot.firstUnreadIndex
          : previousIndex + 1;
      if (startIndex < 0 || targetIndex < startIndex) {
        return;
      }

      let receivedMessagesRead = 0;
      for (let index = startIndex; index <= targetIndex; index += 1) {
        const message = snapshot.messages[index];
        if (message && message.authorId !== "me") {
          receivedMessagesRead += 1;
        }
      }
      lastCountedReadMessageIdRef.current = messageId;
      if (receivedMessagesRead === 0) {
        return;
      }
      setDisplayedUnreadCountState((current) => {
        if (current.chatKey !== snapshot.chatKey) {
          return current;
        }
        const baselineCount = countBaseline?.count ?? current.count;
        if (baselineCount === null) {
          return current;
        }
        const matrixIncrease =
          countBaseline?.matrixCount !== null &&
          countBaseline?.matrixCount !== undefined &&
          current.matrixCount !== null
            ? Math.max(0, current.matrixCount - countBaseline.matrixCount)
            : 0;
        const optimisticCount = Math.max(
          0,
          baselineCount - receivedMessagesRead + matrixIncrease,
        );
        return {
          ...current,
          count:
            current.count === null
              ? optimisticCount
              : Math.min(current.count, optimisticCount),
        };
      });
    },
    [],
  );

  const flushReadProgress = useCallback(() => {
    if (inFlightReadProgressRef.current) {
      return;
    }
    const progress = pendingReadProgressRef.current;
    if (!progress || progress.chatKey !== readTrackingRef.current.chatKey) {
      pendingReadProgressRef.current = null;
      return;
    }
    if (lastMarkedMessageIdRef.current === progress.messageId) {
      pendingReadProgressRef.current = null;
      if (progress.clearBoundary) {
        setClearedBoundaryChatKey(progress.chatKey);
      }
      return;
    }

    pendingReadProgressRef.current = null;
    const displayedCount = displayedUnreadCountStateRef.current;
    const inFlightProgress: InFlightReadProgress = {
      ...progress,
      countBaseline:
        displayedCount.chatKey === progress.chatKey
          ? {
              count: displayedCount.count,
              matrixCount: displayedCount.matrixCount,
            }
          : { count: null, matrixCount: null },
    };
    inFlightReadProgressRef.current = inFlightProgress;
    let succeeded = false;
    void markChatReadRef
      .current(progress.messageId)
      .then(() => {
        succeeded = true;
        if (progress.chatKey !== readTrackingRef.current.chatKey) {
          return;
        }
        lastMarkedMessageIdRef.current = progress.messageId;
        markReadRetryCountRef.current = 0;
        commitDisplayedReadProgress(
          progress.messageId,
          progress.clearBoundary,
          inFlightProgress.countBaseline,
        );
        if (progress.clearBoundary) {
          setClearedBoundaryChatKey(progress.chatKey);
        }
      })
      .catch(() => {
        if (progress.chatKey !== readTrackingRef.current.chatKey) {
          return;
        }
        const pending = pendingReadProgressRef.current;
        const indexes = readTrackingRef.current.messageIndexById;
        const failedIndex = indexes.get(progress.messageId) ?? -1;
        const pendingIndex = pending
          ? (indexes.get(pending.messageId) ?? -1)
          : -1;
        if (!pending || failedIndex >= pendingIndex) {
          pendingReadProgressRef.current = {
            ...progress,
            clearBoundary:
              progress.clearBoundary || Boolean(pending?.clearBoundary),
          };
        }
        const retryDelay = Math.min(
          1000 * 2 ** markReadRetryCountRef.current,
          MARK_READ_RETRY_MAX_MS,
        );
        markReadRetryCountRef.current += 1;
        scheduleReadProgressFlush(retryDelay);
      })
      .finally(() => {
        if (inFlightReadProgressRef.current === inFlightProgress) {
          inFlightReadProgressRef.current = null;
        }
        if (
          succeeded &&
          pendingReadProgressRef.current?.chatKey ===
            readTrackingRef.current.chatKey
        ) {
          scheduleReadProgressFlush(0);
        }
      });
  }, [commitDisplayedReadProgress, scheduleReadProgressFlush]);
  flushReadProgressRef.current = flushReadProgress;

  const captureVisibleReadProgress = useCallback(() => {
    const snapshot = readTrackingRef.current;
    const scroller = scrollerRef.current;
    if (
      !snapshot.partialEnabled ||
      !(scroller instanceof HTMLElement) ||
      !document.hasFocus()
    ) {
      return;
    }

    const viewport = scroller.getBoundingClientRect();
    let candidateId: string | null = null;
    let candidateIndex = -1;
    scroller
      .querySelectorAll<HTMLElement>("[data-chat-message-id]")
      .forEach((row) => {
        const messageId = row.dataset.chatMessageId;
        const index = messageId
          ? snapshot.messageIndexById.get(messageId)
          : undefined;
        if (messageId === undefined || index === undefined) {
          return;
        }
        const bounds = row.getBoundingClientRect();
        const bottomIsVisible =
          bounds.bottom >= viewport.top && bounds.bottom <= viewport.bottom + 1;
        if (
          bottomIsVisible &&
          bounds.top < viewport.bottom &&
          index > candidateIndex
        ) {
          candidateId = messageId;
          candidateIndex = index;
        }
      });

    if (candidateId && rememberReadProgress(candidateId, false)) {
      scheduleReadProgressFlush();
    }
  }, [rememberReadProgress, scheduleReadProgressFlush]);

  /** Mark only the true live end, never the bottom of a contextual window. */
  const maybeMarkRead = useCallback(() => {
    const latestId = lastMessage?.id;
    if (
      isInitialLoading ||
      hasNewer ||
      positionedChatKey !== chatKey ||
      !atBottomRef.current ||
      !latestId ||
      (typeof document !== "undefined" && !document.hasFocus())
    ) {
      return;
    }
    if (rememberReadProgress(latestId, true)) {
      scheduleReadProgressFlush();
    }
  }, [
    chatKey,
    hasNewer,
    isInitialLoading,
    isUnread,
    lastMessage?.id,
    positionedChatKey,
    readTrackingReadyChatKey,
    rememberReadProgress,
    scheduleReadProgressFlush,
  ]);

  useEffect(() => {
    furthestReadMessageIdRef.current = null;
    lastCountedReadMessageIdRef.current = null;
    pendingReadProgressRef.current = null;
    inFlightReadProgressRef.current = null;
    lastMarkedMessageIdRef.current = null;
    markReadRetryCountRef.current = 0;
    pendingUnreadJumpRef.current = false;
    unreadScrollAnimationRef.current = false;
    unreadScrollStartedRef.current = false;
    anchoredBottomStateReadyRef.current = false;
    setPositionedChatKey(null);
    setReadTrackingReadyChatKey(null);
    setUnreadNavigationChatKey(null);
    setUnreadJumpRequest(0);
    setIsJumpingToUnread(false);
    setIsOpeningFirstUnread(false);
    setIsMarkingMainRead(false);
    setClearedBoundaryChatKey(null);
    return () => {
      if (markReadTimerRef.current !== null) {
        window.clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = null;
      }
      if (pendingBottomSyncRaf.current !== null) {
        cancelAnimationFrame(pendingBottomSyncRaf.current);
        pendingBottomSyncRaf.current = null;
      }
      if (pendingUnreadScrollTimer.current !== null) {
        window.clearTimeout(pendingUnreadScrollTimer.current);
        pendingUnreadScrollTimer.current = null;
      }
      const pending = pendingReadProgressRef.current;
      if (pending?.chatKey === chatKey) {
        pendingReadProgressRef.current = null;
        void markChatRead(pending.messageId);
      }
    };
  }, [chatKey, markChatRead]);

  useEffect(() => {
    setDisplayedUnreadCountState((current) => {
      if (current.chatKey !== chatKey) {
        return {
          chatKey,
          count: matrixMainUnreadCount,
          matrixCount: matrixMainUnreadCount,
        };
      }
      if (
        matrixMainUnreadCount === null ||
        current.matrixCount === matrixMainUnreadCount
      ) {
        return current;
      }
      if (current.matrixCount === null || current.count === null) {
        return {
          ...current,
          count: matrixMainUnreadCount,
          matrixCount: matrixMainUnreadCount,
        };
      }

      const count =
        matrixMainUnreadCount > current.matrixCount
          ? current.count + matrixMainUnreadCount - current.matrixCount
          : Math.min(current.count, matrixMainUnreadCount);
      return { ...current, count, matrixCount: matrixMainUnreadCount };
    });
  }, [chatKey, matrixMainUnreadCount]);

  useEffect(() => {
    maybeMarkRead();
    window.addEventListener("focus", maybeMarkRead);
    return () => {
      window.removeEventListener("focus", maybeMarkRead);
    };
  }, [maybeMarkRead]);

  useEffect(() => {
    if (!scrollerElement) {
      return;
    }
    const onScroll = () => {
      if (viewportReadRafRef.current !== null) {
        return;
      }
      viewportReadRafRef.current = requestAnimationFrame(() => {
        viewportReadRafRef.current = null;
        captureVisibleReadProgress();
        if (pendingReadProgressRef.current) {
          scheduleReadProgressFlush();
        }
      });
    };
    scrollerElement.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollerElement.removeEventListener("scroll", onScroll);
      if (viewportReadRafRef.current !== null) {
        cancelAnimationFrame(viewportReadRafRef.current);
        viewportReadRafRef.current = null;
      }
    };
  }, [captureVisibleReadProgress, scheduleReadProgressFlush, scrollerElement]);

  useEffect(() => {
    const canTrackCurrentPosition =
      clearedBoundaryChatKey === chatKey ||
      !isUnread ||
      unread.mainTimelineUnread === false ||
      (unreadNavigationChatKey === chatKey && !isJumpingToUnread);
    if (positionedChatKey !== chatKey || !canTrackCurrentPosition) {
      return;
    }
    const raf = requestAnimationFrame(() => {
      setReadTrackingReadyChatKey(chatKey);
    });
    return () => cancelAnimationFrame(raf);
  }, [
    chatKey,
    clearedBoundaryChatKey,
    isUnread,
    isJumpingToUnread,
    positionedChatKey,
    unread.mainTimelineUnread,
    unreadNavigationChatKey,
  ]);

  useEffect(() => {
    if (readTrackingReadyChatKey !== chatKey) {
      return;
    }
    const raf = requestAnimationFrame(captureVisibleReadProgress);
    maybeMarkRead();
    return () => cancelAnimationFrame(raf);
  }, [
    captureVisibleReadProgress,
    chatKey,
    maybeMarkRead,
    readTrackingReadyChatKey,
  ]);

  const handleScrollerRef = useCallback(
    (element: HTMLElement | Window | null) => {
      scrollerRef.current = element;
      setScrollerElement(element instanceof HTMLElement ? element : null);
    },
    [],
  );

  const [skeletonState, setSkeletonState] = useState<SkeletonState>("visible");
  const needsInitialPosition =
    isInitialLoading || positionedChatKey !== chatKey;

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

  // Conversation opening always lands on the live end. The unread context is
  // resolved and installed only when the user activates the composer banner.
  useEffect(() => {
    if (
      isInitialLoading ||
      positionedChatKey === chatKey ||
      anchorStatus === null
    ) {
      return;
    }
    pendingScrollTimer.current = window.setTimeout(() => {
      pendingScrollTimer.current = null;
      pendingScrollRaf.current = requestAnimationFrame(() => {
        pendingScrollRaf.current = null;
        virtuosoRef.current?.scrollToIndex({
          index: "LAST",
          align: "end",
          behavior: "auto",
        });
        setPositionedChatKey(chatKey);
      });
    }, 250);
    return () => {
      if (pendingScrollTimer.current !== null) {
        window.clearTimeout(pendingScrollTimer.current);
        pendingScrollTimer.current = null;
      }
      if (pendingScrollRaf.current !== null) {
        cancelAnimationFrame(pendingScrollRaf.current);
        pendingScrollRaf.current = null;
      }
    };
  }, [anchorStatus, chatKey, isInitialLoading, positionedChatKey]);

  const finishUnreadJump = useCallback(() => {
    if (!unreadScrollAnimationRef.current) {
      return;
    }
    unreadScrollAnimationRef.current = false;
    unreadScrollStartedRef.current = false;
    if (pendingUnreadScrollTimer.current !== null) {
      window.clearTimeout(pendingUnreadScrollTimer.current);
      pendingUnreadScrollTimer.current = null;
    }
    pendingBottomSyncRaf.current = requestAnimationFrame(() => {
      pendingBottomSyncRaf.current = null;
      const scroller = scrollerRef.current;
      if (scroller instanceof HTMLElement) {
        atBottomRef.current =
          scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <=
          1;
      }
      anchoredBottomStateReadyRef.current = true;
      setIsJumpingToUnread(false);
    });
  }, []);

  const handleOpenFirstUnread = useCallback(() => {
    if (isOpeningFirstUnread || unreadScrollAnimationRef.current) {
      return;
    }
    shouldStickToBottomRef.current = false;
    atBottomRef.current = false;
    pendingUnreadJumpRef.current = true;
    anchoredBottomStateReadyRef.current = false;
    setIsJumpingToUnread(true);
    setIsOpeningFirstUnread(true);
    void openFirstUnread()
      .then((opened) => {
        if (!opened) {
          pendingUnreadJumpRef.current = false;
          setIsJumpingToUnread(false);
          return;
        }
        // The freshly-resolved boundary can occupy the same array index as
        // the previous one. An explicit request makes the positioning effect
        // run even when all derived anchor values are numerically unchanged.
        setUnreadJumpRequest((current) => current + 1);
      })
      .catch(() => {
        pendingUnreadJumpRef.current = false;
        setIsJumpingToUnread(false);
      })
      .finally(() => setIsOpeningFirstUnread(false));
  }, [isOpeningFirstUnread, openFirstUnread]);

  // Installing the contextual page changes the Virtuoso data first. Apply the
  // requested position on the following frame so the separator's row exists.
  useEffect(() => {
    if (
      !pendingUnreadJumpRef.current ||
      isInitialLoading ||
      anchorStatus !== "resolved" ||
      firstUnreadIndex < 0
    ) {
      return;
    }
    const raf = requestAnimationFrame(() => {
      pendingUnreadJumpRef.current = false;
      shouldStickToBottomRef.current = false;
      atBottomRef.current = false;
      setReadTrackingReadyChatKey(null);
      const scrollerHeight =
        scrollerRef.current && "clientHeight" in scrollerRef.current
          ? scrollerRef.current.clientHeight
          : 0;
      unreadScrollAnimationRef.current = true;
      unreadScrollStartedRef.current = false;
      pendingUnreadScrollTimer.current = window.setTimeout(
        finishUnreadJump,
        UNREAD_SCROLL_FALLBACK_MS,
      );
      virtuosoRef.current?.scrollToIndex({
        index: firstUnreadIndex,
        align: "start",
        offset: -Math.round(scrollerHeight / 3),
        behavior: "smooth",
      });
      setUnreadNavigationChatKey(chatKey);
    });
    return () => cancelAnimationFrame(raf);
  }, [
    anchorStatus,
    chatKey,
    finishUnreadJump,
    firstUnreadIndex,
    isInitialLoading,
    unreadJumpRequest,
  ]);

  const handleMarkMainRead = useCallback(() => {
    const messageId = liveEndMessageRef.current.messageId;
    if (!messageId || isMarkingMainRead) {
      return;
    }
    setIsMarkingMainRead(true);
    void markChatRead(messageId)
      .then(() => {
        lastMarkedMessageIdRef.current = messageId;
        furthestReadMessageIdRef.current = messageId;
        pendingReadProgressRef.current = null;
        markReadRetryCountRef.current = 0;
        commitDisplayedReadProgress(messageId, true);
        setClearedBoundaryChatKey(chatKey);
      })
      .catch(() => undefined)
      .finally(() => setIsMarkingMainRead(false));
  }, [chatKey, commitDisplayedReadProgress, isMarkingMainRead, markChatRead]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: "LAST",
      align: "end",
      behavior: "auto",
    });
  }, []);

  // New live events never change the anchored separator. Follow only when the
  // loaded window has reached the live end and the reader is already there,
  // or when the newly appended message is their own send.
  useLayoutEffect(() => {
    const previous = previousAppendState.current;
    const isSameChat = previous.chatKey === chatKey;
    const didAppendLatest =
      messages.length > previous.messageCount &&
      lastMessage?.id !== previous.lastMessageId;
    const canFollowAnchoredBottom =
      unreadNavigationChatKey !== chatKey ||
      (anchoredBottomStateReadyRef.current && atBottomRef.current);
    const shouldFollowAppend =
      !isJumpingToUnread &&
      !hasNewer &&
      (canFollowAnchoredBottom || lastMessage?.authorId === "me");
    previousAppendState.current = {
      chatKey,
      messageCount: messages.length,
      lastMessageId: lastMessage?.id ?? null,
    };

    if (!isSameChat || !didAppendLatest || !shouldFollowAppend) {
      return;
    }

    shouldStickToBottomRef.current = true;
    scrollToBottom();
  }, [
    chatKey,
    hasNewer,
    isJumpingToUnread,
    lastMessage?.authorId,
    lastMessage?.id,
    messages.length,
    scrollToBottom,
    unreadNavigationChatKey,
  ]);

  const hasActiveUnreadBoundary =
    isUnread && clearedBoundaryChatKey !== chatKey;
  const hasActiveMainUnread =
    hasActiveUnreadBoundary &&
    unread.mainTimelineUnread === true &&
    !isInitialLoading &&
    positionedChatKey === chatKey;
  const showUnreadSeparator =
    hasActiveUnreadBoundary &&
    unreadNavigationChatKey === chatKey &&
    anchorStatus === "resolved" &&
    firstUnreadMessageId !== null;
  const unreadNavigation = useMemo<MainTimelineUnreadNavigation | null>(() => {
    if (!hasActiveMainUnread) {
      return null;
    }
    return {
      count: displayedUnreadCount,
      status:
        unreadAnchorStatus === "resolved" ||
        unreadAnchorStatus === "unavailable"
          ? unreadAnchorStatus
          : "unresolved",
      isOpening: isOpeningFirstUnread || isJumpingToUnread,
      isMarkingRead: isMarkingMainRead,
      open: handleOpenFirstUnread,
      markRead: handleMarkMainRead,
    };
  }, [
    handleMarkMainRead,
    handleOpenFirstUnread,
    hasActiveMainUnread,
    displayedUnreadCount,
    isMarkingMainRead,
    isOpeningFirstUnread,
    isJumpingToUnread,
    unreadAnchorStatus,
  ]);

  useEffect(() => {
    onUnreadNavigationChange?.(unreadNavigation);
  }, [onUnreadNavigationChange, unreadNavigation]);

  useEffect(
    () => () => onUnreadNavigationChange?.(null),
    [chatKey, onUnreadNavigationChange],
  );

  return (
    <div className="hub__chat-conversation__list">
      {!isInitialLoading && (
        <Virtuoso
          ref={virtuosoRef}
          scrollerRef={handleScrollerRef}
          data={messages}
          firstItemIndex={firstItemIndex}
          computeItemKey={(_index, message) => message.id}
          defaultItemHeight={DEFAULT_ITEM_HEIGHT}
          initialTopMostItemIndex={Math.max(0, messages.length - 1)}
          followOutput={
            isJumpingToUnread || unreadNavigationChatKey === chatKey
              ? false
              : "auto"
          }
          isScrolling={(isScrolling) => {
            if (!unreadScrollAnimationRef.current) {
              return;
            }
            if (isScrolling) {
              unreadScrollStartedRef.current = true;
              return;
            }
            if (unreadScrollStartedRef.current) {
              finishUnreadJump();
            }
          }}
          atBottomStateChange={(atBottom) => {
            atBottomRef.current = atBottom;
            if (
              !atBottom &&
              !isJumpingToUnread &&
              unreadNavigationChatKey === chatKey
            ) {
              anchoredBottomStateReadyRef.current = true;
            }
            if (atBottom) {
              shouldStickToBottomRef.current = false;
              if (hasNewer && !isJumpingToUnread) {
                fetchNewer();
              } else {
                maybeMarkRead();
              }
            }
          }}
          totalListHeightChanged={() => {
            if (shouldStickToBottomRef.current) {
              scrollToBottom();
            }
          }}
          startReached={hasOlder ? fetchOlder : undefined}
          endReached={hasNewer && !isJumpingToUnread ? fetchNewer : undefined}
          increaseViewportBy={{ top: 400, bottom: 400 }}
          components={{
            Header: () => (
              <div className="hub__chat-conversation__top-spacer">
                {isFetchingOlder && (
                  <TimelineStatus label={t("Loading older messages…")} />
                )}
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
            return (
              <Row
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
              />
            );
          }}
        />
      )}
      {!isInitialLoading &&
        hasActiveUnreadBoundary &&
        anchorStatus === "unavailable" && (
          <div className="hub__chat-conversation__unread-unavailable">
            <TimelineStatus
              label={t("Unread messages are above")}
              icon="north"
              loading={false}
            />
          </div>
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

const TimelineStatus = ({
  label,
  icon = "sync",
  loading = true,
}: {
  label: string;
  icon?: string;
  loading?: boolean;
}) => (
  <div
    className="hub__chat-conversation__top-loader"
    role="status"
    data-loading={loading || undefined}
  >
    <span className="material-icons" aria-hidden="true">
      {icon}
    </span>
    {label}
  </div>
);

type RowProps = {
  message: ChatMessage;
  chatRef: ChatRef;
  prev: ChatMessage | undefined;
  next: ChatMessage | undefined;
  authorsById: Map<string, ChatMessageAuthor>;
  showUnreadSeparator: boolean;
};

const Row = memo(function Row({
  message,
  chatRef,
  prev,
  next,
  authorsById,
  showUnreadSeparator,
}: RowProps) {
  const isSent = message.authorId === "me";
  const isFirstOfGroup = !prev || prev.authorId !== message.authorId;
  const isLastOfGroup = !next || next.authorId !== message.authorId;

  if (isSent) {
    return (
      <RowShell messageId={message.id} separator={showUnreadSeparator}>
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
    <RowShell messageId={message.id} separator={showUnreadSeparator}>
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
  separator,
}: {
  children: React.ReactNode;
  messageId: string;
  separator: boolean;
}) => (
  <div className="hub__chat-conversation__row" data-chat-message-id={messageId}>
    <div className="hub__chat-conversation__row-inner">
      {separator && <UnreadSeparator />}
      {children}
    </div>
  </div>
);
