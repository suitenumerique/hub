import { Suspense, lazy, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

const EmojiPickerPanel = lazy(() => import("./EmojiPickerPanel"));

type EmojiPickerPopoverProps = {
  /** The trigger element the popover is positioned against. */
  anchor: HTMLElement;
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

const GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Portals the emoji picker to `document.body` so it escapes the virtual-list
 * scroll container, positions it against the trigger (flipping above when
 * there is no room below), and closes on outside-click, Escape, and scroll.
 */
export const EmojiPickerPopover = ({
  anchor,
  onSelect,
  onClose,
}: EmojiPickerPopoverProps) => {
  const { t } = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Positioned imperatively (not via an inline style prop) so all static
  // styling stays in SCSS — only the two runtime coordinates are set here.
  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover) {
      return;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const { width, height } = popover.getBoundingClientRect();
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const flipsUp = spaceBelow < height + GAP && anchorRect.top > height + GAP;
    const top = flipsUp
      ? anchorRect.top - height - GAP
      : anchorRect.bottom + GAP;
    const left = Math.min(
      Math.max(anchorRect.left, VIEWPORT_MARGIN),
      window.innerWidth - width - VIEWPORT_MARGIN,
    );
    popover.style.top = `${Math.max(top, VIEWPORT_MARGIN)}px`;
    popover.style.left = `${Math.max(left, VIEWPORT_MARGIN)}px`;
  }, [anchor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popoverRef.current?.contains(target) && !anchor.contains(target)) {
        onClose();
      }
    };
    const onScroll = (event: Event) => {
      // Scrolling inside the picker itself must NOT close it — only close
      // when the chat (or page) scrolls and the anchor moves away.
      if (!popoverRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={popoverRef}
      className="hub__emoji-picker-popover"
      role="dialog"
      aria-label={t("Emoji picker")}
    >
      <Suspense
        fallback={
          <div className="hub__emoji-picker-popover__loading" role="status">
            {t("Loading emoji…")}
          </div>
        }
      >
        <EmojiPickerPanel onSelect={onSelect} />
      </Suspense>
    </div>,
    document.body,
  );
};
