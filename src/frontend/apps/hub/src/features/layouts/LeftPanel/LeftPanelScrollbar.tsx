import { type PointerEvent, useEffect, useRef, useState } from "react";

// As with a native scrollbar, a long list keeps a thumb that can be grabbed.
const MIN_THUMB_HEIGHT = 24;
// How long the bar stays shown once the list stops scrolling: with its 200ms
// fade, it is gone 0.7s after the last scroll.
const SCROLL_IDLE_DELAY = 500;

type Geometry = {
  maxScroll: number;
  thumbHeight: number;
  /** How far the thumb moves along the track. */
  travel: number;
};

// The track spans the part of the list seen between the top and the footer:
// the list shows the track's height out of all it scrolls by plus that.
const readGeometry = (
  scrollElement: HTMLElement,
  track: HTMLElement,
): Geometry => {
  const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
  const trackHeight = track.clientHeight;
  const thumbHeight = Math.max(
    MIN_THUMB_HEIGHT,
    (trackHeight * trackHeight) / (maxScroll + trackHeight),
  );
  return { maxScroll, thumbHeight, travel: trackHeight - thumbHeight };
};

type Drag = {
  pointerId: number;
  startY: number;
  startScrollTop: number;
  /** The list's scroll for one pixel of the thumb. */
  ratio: number;
};

/**
 * The conversation list's scrollbar. The list scrolls under the translucent
 * top and footer, so its native scrollbar ran behind them: it is hidden and
 * this one runs between them. The list keeps its own scrolling (wheel,
 * keyboard, touch): this bar follows it and adds the pointer gestures, so
 * assistive technologies skip it.
 */
export const LeftPanelScrollbar = ({
  scrollElement,
}: {
  scrollElement: HTMLElement | null;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!scrollElement || !track) return;

    const update = () => {
      const hasOverflow =
        scrollElement.scrollHeight > scrollElement.clientHeight;
      track.hidden = !hasOverflow;
      if (!hasOverflow) return;
      const { maxScroll, thumbHeight, travel } = readGeometry(
        scrollElement,
        track,
      );
      // Clamped: Safari's rubber band scrolls past both ends.
      const offset = Math.min(
        travel,
        Math.max(0, (travel * scrollElement.scrollTop) / maxScroll),
      );
      track.style.setProperty("--hub-lp-thumb-height", `${thumbHeight}px`);
      track.style.setProperty("--hub-lp-thumb-offset", `${offset}px`);
    };

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = (event: Event) => {
      update();
      // The panel also sends scroll events of its own when its parts resize
      // (for Virtuoso): only a real scroll shows the bar.
      if (!event.isTrusted) return;
      track.dataset.scrolling = "true";
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        delete track.dataset.scrolling;
      }, SCROLL_IDLE_DELAY);
    };

    // The panel's height, and the sections as they load, open, close or come
    // and go. The track itself is not observed: hiding it from a resize
    // callback would loop, and the panel sends a scroll event when the top or
    // the footer, between which it runs, resize.
    const resizeObserver = new ResizeObserver(update);
    const observeContent = () => {
      resizeObserver.observe(scrollElement);
      for (const child of scrollElement.children) resizeObserver.observe(child);
    };
    const mutationObserver = new MutationObserver(() => {
      observeContent();
      update();
    });

    observeContent();
    mutationObserver.observe(scrollElement, { childList: true });
    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      clearTimeout(idleTimer);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      scrollElement.removeEventListener("scroll", onScroll);
    };
  }, [scrollElement]);

  // Dragging the thumb scrolls the list in proportion.
  const onThumbPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (event.button !== 0 || !scrollElement || !track) return;
    const { maxScroll, travel } = readGeometry(scrollElement, track);
    if (travel <= 0) return;
    // No text selection and no press on the track below.
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: scrollElement.scrollTop,
      ratio: maxScroll / travel,
    };
    setIsDragging(true);
  };

  const onThumbPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !scrollElement) return;
    scrollElement.scrollTop =
      drag.startScrollTop + (event.clientY - drag.startY) * drag.ratio;
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
  };

  // A press on the track scrolls one view towards the pointer.
  const onTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const thumb = thumbRef.current;
    if (
      event.button !== 0 ||
      event.target !== event.currentTarget ||
      !scrollElement ||
      !thumb
    )
      return;
    event.preventDefault();
    const direction =
      event.clientY < thumb.getBoundingClientRect().top ? -1 : 1;
    scrollElement.scrollBy({
      top: direction * event.currentTarget.clientHeight,
    });
  };

  return (
    <div
      ref={trackRef}
      className="hub__left-panel__scrollbar"
      data-dragging={isDragging || undefined}
      aria-hidden="true"
      onPointerDown={onTrackPointerDown}
    >
      <div
        ref={thumbRef}
        className="hub__left-panel__scrollbar__thumb"
        onPointerDown={onThumbPointerDown}
        onPointerMove={onThumbPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      />
    </div>
  );
};
