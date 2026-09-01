import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { notify } from "@/features/ui/components/toast";

import type { MainTimelineReadActions } from "./useMarkChatRead";
import type { OpenReadMarkerResult } from "./useChatMessages";

const READ_RECEIPT_DEBOUNCE_MS = 500;

type ReadMarkerPosition = "absent" | "above" | "visible" | "below" | "unknown";

export type MainTimelineViewportState = {
  readMarkerPosition: ReadMarkerPosition;
  readReceiptCandidateId: string | null;
  fullyReadCandidateId: string | null;
};

export type MainTimelineUnreadNavigation = {
  isOpening: boolean;
  isMarkingRead: boolean;
  open: () => void;
  markRead: () => void;
};

type UseMainTimelineUnreadOptions = {
  chatKey: string;
  enabled: boolean;
  readMarkerEventId: string | null;
  readMarkerWindowKey: string | null;
  openReadMarker: () => Promise<OpenReadMarkerResult>;
  readActions: MainTimelineReadActions;
};

type FullyReadSession = {
  chatKey: string;
  candidateId: string | null;
};

type PendingFullyReadFlush = {
  timer: ReturnType<typeof setTimeout>;
};

const pendingFullyReadFlushes = new Map<string, PendingFullyReadFlush>();

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

/**
 * Owns the frozen unread marker UI and the two independent Matrix read writes.
 */
export const useMainTimelineUnread = ({
  chatKey,
  enabled,
  readMarkerEventId,
  readMarkerWindowKey,
  openReadMarker,
  readActions,
}: UseMainTimelineUnreadOptions) => {
  const { t } = useTranslation();
  const separatorRef = useRef<HTMLDivElement>(null);
  const receiptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReceiptId = useRef<string | null>(null);
  const lastSubmittedReceiptId = useRef<string | null>(null);
  const activeChatKey = useRef(chatKey);
  const openingRequestId = useRef(0);
  const markAllRequestId = useRef(0);
  const fullyReadSession = useRef<FullyReadSession>({
    chatKey,
    candidateId: null,
  });
  const [markerState, setMarkerState] = useState<{
    windowKey: string | null;
    position: ReadMarkerPosition;
  }>({
    windowKey: readMarkerWindowKey,
    position: readMarkerWindowKey ? "unknown" : "absent",
  });
  const [jumpRequest, setJumpRequest] = useState(0);
  const [jumpDisabled, setJumpDisabled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  const { advanceReadReceipt, advanceFullyRead, markAllRead } = readActions;

  const clearReceiptTimer = useCallback(() => {
    if (receiptTimer.current !== null) {
      clearTimeout(receiptTimer.current);
      receiptTimer.current = null;
    }
    pendingReceiptId.current = null;
  }, []);

  useEffect(() => {
    activeChatKey.current = chatKey;
    openingRequestId.current += 1;
    markAllRequestId.current += 1;
    lastSubmittedReceiptId.current = null;
    clearReceiptTimer();
    setJumpDisabled(false);
    setDismissed(false);
    setIsOpening(false);
    setIsMarkingRead(false);
  }, [chatKey, clearReceiptTimer]);

  useEffect(() => {
    if (!enabled) {
      clearReceiptTimer();
    }
  }, [clearReceiptTimer, enabled]);

  useEffect(
    () => () => {
      clearReceiptTimer();
      activeChatKey.current = "";
      openingRequestId.current += 1;
      markAllRequestId.current += 1;
    },
    [clearReceiptTimer],
  );

  useEffect(() => {
    const pending = pendingFullyReadFlushes.get(chatKey);
    if (pending) {
      clearTimeout(pending.timer);
      pendingFullyReadFlushes.delete(chatKey);
    }

    const previousSession = fullyReadSession.current;
    const session =
      previousSession.chatKey === chatKey
        ? previousSession
        : { chatKey, candidateId: null };
    fullyReadSession.current = session;
    const advanceForChat = advanceFullyRead;

    return () => {
      const candidateId = session.candidateId;
      if (!candidateId) {
        return;
      }
      const previous = pendingFullyReadFlushes.get(chatKey);
      if (previous) {
        clearTimeout(previous.timer);
      }
      const flush: PendingFullyReadFlush = {
        timer: setTimeout(() => {
          if (pendingFullyReadFlushes.get(chatKey) !== flush) {
            return;
          }
          pendingFullyReadFlushes.delete(chatKey);
          void advanceForChat(candidateId).catch(() => undefined);
        }, 0),
      };
      pendingFullyReadFlushes.set(chatKey, flush);
    };
  }, [advanceFullyRead, chatKey]);

  const onViewportMeasured = useCallback(
    ({
      readMarkerPosition,
      readReceiptCandidateId,
      fullyReadCandidateId,
    }: MainTimelineViewportState) => {
      setMarkerState((current) =>
        current.windowKey === readMarkerWindowKey &&
        current.position === readMarkerPosition
          ? current
          : {
              windowKey: readMarkerWindowKey,
              position: readMarkerPosition,
            },
      );

      if (!enabled || dismissed) {
        if (fullyReadSession.current.chatKey === chatKey) {
          fullyReadSession.current.candidateId = null;
        }
        clearReceiptTimer();
        return;
      }
      if (fullyReadSession.current.chatKey === chatKey) {
        fullyReadSession.current.candidateId = fullyReadCandidateId;
      }
      if (!readReceiptCandidateId) {
        clearReceiptTimer();
        return;
      }
      if (
        readReceiptCandidateId === lastSubmittedReceiptId.current ||
        readReceiptCandidateId === pendingReceiptId.current
      ) {
        return;
      }

      clearReceiptTimer();
      pendingReceiptId.current = readReceiptCandidateId;
      receiptTimer.current = setTimeout(() => {
        receiptTimer.current = null;
        pendingReceiptId.current = null;
        lastSubmittedReceiptId.current = readReceiptCandidateId;
        const allowReceiptRetry = () => {
          if (lastSubmittedReceiptId.current === readReceiptCandidateId) {
            lastSubmittedReceiptId.current = null;
          }
        };
        void advanceReadReceipt(readReceiptCandidateId)
          .then(({ status }) => {
            if (status === "unavailable") {
              allowReceiptRetry();
            }
          })
          .catch(allowReceiptRetry);
      }, READ_RECEIPT_DEBOUNCE_MS);
    },
    [
      advanceReadReceipt,
      chatKey,
      clearReceiptTimer,
      dismissed,
      enabled,
      readMarkerWindowKey,
    ],
  );

  const failUnreadJump = useCallback(() => {
    setJumpDisabled(true);
    notify.error(t("Something bad happens, please retry."));
  }, [t]);

  const open = useCallback(() => {
    if (
      !enabled ||
      !readMarkerEventId ||
      jumpDisabled ||
      dismissed ||
      isOpening
    ) {
      return;
    }
    if (readMarkerWindowKey) {
      setJumpRequest((current) => current + 1);
      return;
    }

    const requestId = openingRequestId.current + 1;
    openingRequestId.current = requestId;
    setIsOpening(true);
    void openReadMarker()
      .then((result) => {
        if (
          activeChatKey.current !== chatKey ||
          openingRequestId.current !== requestId
        ) {
          return;
        }
        if (result.status === "opened") {
          setJumpRequest((current) => current + 1);
        } else {
          failUnreadJump();
        }
      })
      .catch(() => {
        if (
          activeChatKey.current === chatKey &&
          openingRequestId.current === requestId
        ) {
          failUnreadJump();
        }
      })
      .finally(() => {
        if (
          activeChatKey.current === chatKey &&
          openingRequestId.current === requestId
        ) {
          setIsOpening(false);
        }
      });
  }, [
    chatKey,
    dismissed,
    enabled,
    failUnreadJump,
    isOpening,
    jumpDisabled,
    openReadMarker,
    readMarkerEventId,
    readMarkerWindowKey,
  ]);

  const markRead = useCallback(() => {
    if (!enabled || dismissed || isMarkingRead) {
      return;
    }
    const focusOrigin = document.activeElement;
    clearReceiptTimer();
    fullyReadSession.current.candidateId = null;
    const requestId = markAllRequestId.current + 1;
    markAllRequestId.current = requestId;
    setDismissed(true);
    setIsMarkingRead(true);
    void markAllRead()
      .then(() => {
        if (
          activeChatKey.current === chatKey &&
          markAllRequestId.current === requestId
        ) {
          restoreComposerFocus(focusOrigin);
        }
      })
      .catch(() => {
        if (
          activeChatKey.current === chatKey &&
          markAllRequestId.current === requestId
        ) {
          setDismissed(false);
          notify.error(t("Something bad happens, please retry."));
          restoreComposerFocus(focusOrigin);
        }
      })
      .finally(() => {
        if (
          activeChatKey.current === chatKey &&
          markAllRequestId.current === requestId
        ) {
          setIsMarkingRead(false);
        }
      });
  }, [
    chatKey,
    clearReceiptTimer,
    dismissed,
    enabled,
    isMarkingRead,
    markAllRead,
    t,
  ]);

  const markerPosition =
    markerState.windowKey === readMarkerWindowKey
      ? markerState.position
      : readMarkerWindowKey
        ? "unknown"
        : "absent";
  const canJump =
    enabled &&
    Boolean(readMarkerEventId) &&
    !dismissed &&
    !jumpDisabled &&
    (markerPosition === "absent" || markerPosition === "above");

  const navigation = useMemo<MainTimelineUnreadNavigation | null>(
    () =>
      canJump
        ? {
            isOpening,
            isMarkingRead,
            open,
            markRead,
          }
        : null,
    [canJump, isMarkingRead, isOpening, markRead, open],
  );

  return {
    jumpRequest,
    navigation,
    onViewportMeasured,
    separatorRef,
    showReadMarker:
      Boolean(readMarkerEventId) && Boolean(readMarkerWindowKey) && !dismissed,
  };
};
