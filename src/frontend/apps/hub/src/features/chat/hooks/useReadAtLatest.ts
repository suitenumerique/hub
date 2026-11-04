import { useEffect, useState } from "react";

import type { UseMainTimelineUnreadResult } from "./useMainTimelineUnread";
import type { MarkedUnreadGate } from "./useMarkedUnreadGate";

// Time at the latest messages, with the page in front, before reading them.
const READ_DWELL_MS = 250;

const isPageActive = () =>
  document.visibilityState === "visible" && document.hasFocus();

/**
 * Opening reads the whole conversation: what is left to read arrived after it,
 * below. It is read once the person is at the latest messages with the page in
 * front. Element reads as messages get displayed instead: with everything read
 * on opening, nothing is left to read further up.
 */
export const useReadAtLatest = ({
  isOpened,
  isAtLatest,
  lastLoadedId,
  unread: { hasUnread, markAllRead },
  markedUnread: { isMarkedUnread, canClear, clearIfAllowed },
}: {
  isOpened: boolean;
  isAtLatest: boolean;
  lastLoadedId: string | undefined;
  unread: UseMainTimelineUnreadResult;
  markedUnread: MarkedUnreadGate;
}): void => {
  const [isActive, setIsActive] = useState(isPageActive);

  useEffect(() => {
    const update = () => setIsActive(isPageActive());
    update();
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const shouldRead = isOpened && isActive && hasUnread && isAtLatest;
  const shouldClearMark = isOpened && isActive && isMarkedUnread && canClear;

  useEffect(() => {
    if (!shouldRead && !shouldClearMark) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (shouldRead) {
        markAllRead(lastLoadedId);
      }
      if (shouldClearMark) {
        clearIfAllowed();
      }
    }, READ_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [clearIfAllowed, lastLoadedId, markAllRead, shouldClearMark, shouldRead]);
};
