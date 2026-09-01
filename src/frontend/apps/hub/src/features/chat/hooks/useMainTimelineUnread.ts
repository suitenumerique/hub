import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ListRange } from "react-virtuoso";

import type { MarkChatReadResult } from "@/features/drivers/Driver";
import type { ChatMessage } from "@/features/drivers/types";

import type { OpenFirstUnreadResult } from "./useChatMessages";

const MARK_READ_DEBOUNCE_MS = 400;

export type MainTimelineUnreadNavigation = {
  count: number;
  isOpening: boolean;
  isMarkingRead: boolean;
  open: () => void;
  markRead: () => void;
};

type ReadingSession = {
  active: boolean;
  atBottom: boolean;
  baselineEndIndex: number;
  jumpPending: boolean;
  lastRange: ListRange | null;
  movingDown: boolean;
  userScrolling: boolean;
};

type UseMainTimelineUnreadOptions = {
  chatKey: string;
  messages: ChatMessage[];
  firstUnreadMessageId: string | null;
  unreadCount: number;
  enabled: boolean;
  hasNewer: boolean;
  openFirstUnread: () => Promise<OpenFirstUnreadResult>;
  markRead: (messageId?: string) => Promise<MarkChatReadResult>;
};

const newSession = (): ReadingSession => ({
  active: false,
  atBottom: false,
  baselineEndIndex: -1,
  jumpPending: false,
  lastRange: null,
  movingDown: false,
  userScrolling: false,
});

const restoreComposerFocus = (origin: Element | null): void => {
  requestAnimationFrame(() => {
    if (
      document.activeElement !== origin &&
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

/** Owns one Matrix-backed main-timeline reading session. */
export const useMainTimelineUnread = ({
  chatKey,
  messages,
  firstUnreadMessageId,
  unreadCount,
  enabled,
  hasNewer,
  openFirstUnread,
  markRead,
}: UseMainTimelineUnreadOptions) => {
  const session = useRef<ReadingSession>(newSession());
  const opening = useRef(false);
  const lastSubmittedMessageId = useRef<string | null>(null);
  const separatorRef = useRef<HTMLDivElement>(null);
  const [candidateMessageId, setCandidateMessageId] = useState<string | null>(
    null,
  );
  const [isOpening, setIsOpening] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [jump, setJump] = useState({
    request: 0,
    targetId: null as string | null,
  });

  const firstUnreadIndex = useMemo(() => {
    if (!enabled || !firstUnreadMessageId) {
      return -1;
    }
    return messages.findIndex((message) => message.id === firstUnreadMessageId);
  }, [enabled, firstUnreadMessageId, messages]);

  useEffect(() => {
    session.current = newSession();
    opening.current = false;
    lastSubmittedMessageId.current = null;
    setCandidateMessageId(null);
    setIsOpening(false);
    setIsMarkingRead(false);
    setJump((current) => ({ request: current.request + 1, targetId: null }));
  }, [chatKey]);

  useEffect(() => {
    if (enabled) {
      return;
    }
    session.current = newSession();
    setCandidateMessageId(null);
  }, [enabled]);

  useEffect(() => {
    if (!candidateMessageId || !enabled) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (lastSubmittedMessageId.current === candidateMessageId) {
        return;
      }
      lastSubmittedMessageId.current = candidateMessageId;
      void markRead(candidateMessageId).catch(() => {
        if (lastSubmittedMessageId.current === candidateMessageId) {
          lastSubmittedMessageId.current = null;
        }
      });
    }, MARK_READ_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [candidateMessageId, enabled, markRead]);

  const queueVisibleMessage = useCallback(
    (index: number) => {
      const messageId = messages[index]?.id;
      if (messageId) {
        setCandidateMessageId(messageId);
      }
    },
    [messages],
  );

  const onVisibleRangeChanged = useCallback(
    (range: ListRange, separatorVisible: boolean) => {
      const current = session.current;
      const previous = current.lastRange;
      current.lastRange = range;

      if (!enabled || firstUnreadIndex < 0 || current.jumpPending) {
        return;
      }
      if (!current.active) {
        if (current.userScrolling && separatorVisible) {
          current.active = true;
          current.baselineEndIndex = range.endIndex;
        }
        return;
      }
      if (!current.userScrolling || !previous) {
        return;
      }

      current.movingDown = range.endIndex > previous.endIndex;
      if (current.movingDown && range.endIndex > current.baselineEndIndex) {
        current.baselineEndIndex = range.endIndex;
        queueVisibleMessage(Math.max(firstUnreadIndex, range.endIndex));
      }
    },
    [enabled, firstUnreadIndex, queueVisibleMessage],
  );

  const queueLiveEndIfReached = useCallback(() => {
    const current = session.current;
    if (
      current.active &&
      current.atBottom &&
      current.movingDown &&
      !current.jumpPending &&
      !hasNewer
    ) {
      queueVisibleMessage(messages.length - 1);
    }
  }, [hasNewer, messages.length, queueVisibleMessage]);

  const onScrolling = useCallback(
    (isScrolling: boolean) => {
      const current = session.current;
      if (current.jumpPending) {
        return;
      }
      if (!isScrolling) {
        queueLiveEndIfReached();
        current.userScrolling = false;
        current.movingDown = false;
      }
    },
    [queueLiveEndIfReached],
  );

  const onUserScroll = useCallback(() => {
    const current = session.current;
    if (!current.jumpPending) {
      current.userScrolling = true;
    }
  }, []);

  const onAtBottomChange = useCallback(
    (atBottom: boolean) => {
      session.current.atBottom = atBottom;
      if (atBottom) {
        queueLiveEndIfReached();
      }
    },
    [queueLiveEndIfReached],
  );

  const open = useCallback(() => {
    if (!enabled || opening.current) {
      return;
    }
    opening.current = true;
    setIsOpening(true);
    void openFirstUnread()
      .then((result) => {
        if (result.status !== "opened") {
          return;
        }
        const current = session.current;
        current.active = true;
        current.jumpPending = true;
        current.lastRange = null;
        current.movingDown = false;
        current.userScrolling = false;
        setCandidateMessageId(null);
        setJump((previous) => ({
          request: previous.request + 1,
          targetId: result.firstUnreadMessageId,
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        opening.current = false;
        setIsOpening(false);
      });
  }, [enabled, openFirstUnread]);

  const completeJump = useCallback(() => {
    const current = session.current;
    current.jumpPending = false;
    current.baselineEndIndex = current.lastRange?.endIndex ?? -1;
    requestAnimationFrame(() =>
      separatorRef.current?.focus({ preventScroll: true }),
    );
  }, []);

  const markAllRead = useCallback(() => {
    if (!enabled || isMarkingRead) {
      return;
    }
    const focusOrigin = document.activeElement;
    setIsMarkingRead(true);
    void markRead()
      .then((result) => {
        if (result.status !== "unavailable") {
          restoreComposerFocus(focusOrigin);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsMarkingRead(false));
  }, [enabled, isMarkingRead, markRead]);

  const navigation = useMemo<MainTimelineUnreadNavigation | null>(
    () =>
      enabled && unreadCount > 0
        ? {
            count: unreadCount,
            isOpening,
            isMarkingRead,
            open,
            markRead: markAllRead,
          }
        : null,
    [enabled, isMarkingRead, isOpening, markAllRead, open, unreadCount],
  );

  return {
    completeJump,
    firstUnreadIndex,
    jump,
    navigation,
    onAtBottomChange,
    onVisibleRangeChanged,
    onScrolling,
    onUserScroll,
    separatorRef,
  };
};
