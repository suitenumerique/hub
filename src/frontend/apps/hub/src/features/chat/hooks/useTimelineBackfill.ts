import { type RefObject, useEffect, useRef } from "react";

// Frames the check waits for Virtuoso to render the first rows.
const FILL_CHECK_MAX_FRAMES = 10;

/**
 * Like Element's ScrollPanel, backfills without waiting for a scroll while the
 * list holds less than one screen beyond its viewport: the first page shows the
 * messages already in memory, however few. Only on the latest messages: a jump
 * opens a complete window, nothing is added around it. After a failed request,
 * only a scroll asks again: requests are not retried, so retrying here would
 * loop while the server keeps failing.
 *
 * The returned check is to run again whenever the list height changes, as
 * Element does: a reloaded window can first measure its previous rows, then
 * shrink below the viewport, where no scroll can ask for more.
 */
export const useTimelineBackfill = ({
  scrollerRef,
  isEnabled,
  messageCount,
  fetchOlder,
}: {
  scrollerRef: RefObject<HTMLElement | null>;
  isEnabled: boolean;
  messageCount: number;
  fetchOlder: () => void;
}): (() => void) => {
  const fillIfShortRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!isEnabled) {
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
  }, [fetchOlder, isEnabled, messageCount, scrollerRef]);

  return () => fillIfShortRef.current();
};
