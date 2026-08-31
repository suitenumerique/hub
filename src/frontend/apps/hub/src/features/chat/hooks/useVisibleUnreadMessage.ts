import { useCallback, useEffect, useState } from "react";

type UseVisibleUnreadMessageOptions = {
  enabled: boolean;
  scroller: HTMLElement | null;
  messageIndexById: Map<string, number>;
  firstUnreadIndex: number;
  isJumping: boolean;
  hasUnreadContext: boolean;
};

/** Tracks the last fully visible unread row after the boundary was reached. */
export const useVisibleUnreadMessage = ({
  enabled,
  scroller,
  messageIndexById,
  firstUnreadIndex,
  isJumping,
  hasUnreadContext,
}: UseVisibleUnreadMessageOptions): string | null => {
  const [manualBoundaryReached, setManualBoundaryReached] = useState(false);
  const [visibleMessageId, setVisibleMessageId] = useState<string | null>(null);

  const capture = useCallback(() => {
    if (
      !enabled ||
      !scroller ||
      firstUnreadIndex < 0 ||
      isJumping ||
      !document.hasFocus()
    ) {
      setVisibleMessageId(null);
      return;
    }

    const viewport = scroller.getBoundingClientRect();
    let boundaryVisible = false;
    let candidateId: string | null = null;
    let candidateIndex = -1;

    scroller
      .querySelectorAll<HTMLElement>("[data-chat-message-id]")
      .forEach((row) => {
        const messageId = row.dataset.chatMessageId;
        const messageIndex = messageId
          ? messageIndexById.get(messageId)
          : undefined;
        if (!messageId || messageIndex === undefined) {
          return;
        }

        const bounds = row.getBoundingClientRect();
        if (
          messageIndex === firstUnreadIndex &&
          bounds.bottom >= viewport.top &&
          bounds.top <= viewport.bottom
        ) {
          boundaryVisible = true;
        }

        const bottomIsVisible =
          bounds.bottom >= viewport.top && bounds.bottom <= viewport.bottom + 1;
        if (
          messageIndex >= firstUnreadIndex &&
          bottomIsVisible &&
          bounds.top < viewport.bottom &&
          messageIndex > candidateIndex
        ) {
          candidateId = messageId;
          candidateIndex = messageIndex;
        }
      });

    if (boundaryVisible) {
      setManualBoundaryReached(true);
    }
    const trackingStarted =
      hasUnreadContext || manualBoundaryReached || boundaryVisible;
    setVisibleMessageId(trackingStarted ? candidateId : null);
  }, [
    enabled,
    firstUnreadIndex,
    hasUnreadContext,
    isJumping,
    manualBoundaryReached,
    messageIndexById,
    scroller,
  ]);

  useEffect(() => {
    if (!enabled) {
      setManualBoundaryReached(false);
      setVisibleMessageId(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!scroller) {
      return;
    }
    let raf: number | null = null;
    const scheduleCapture = () => {
      if (raf !== null) {
        cancelAnimationFrame(raf);
      }
      raf = requestAnimationFrame(() => {
        raf = null;
        capture();
      });
    };
    scheduleCapture();
    scroller.addEventListener("scroll", scheduleCapture, { passive: true });
    window.addEventListener("focus", scheduleCapture);
    window.addEventListener("resize", scheduleCapture);
    return () => {
      scroller.removeEventListener("scroll", scheduleCapture);
      window.removeEventListener("focus", scheduleCapture);
      window.removeEventListener("resize", scheduleCapture);
      if (raf !== null) {
        cancelAnimationFrame(raf);
      }
    };
  }, [capture, scroller]);

  return visibleMessageId;
};
