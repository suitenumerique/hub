import { Suspense, lazy, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

const loadEmojiPickerPanel = () => import("./EmojiPickerPanel");
const EmojiPickerPanel = lazy(loadEmojiPickerPanel);

/** Preload both the component chunk and its remote emoji datasets. */
export const preloadEmojiPicker = (language: string): void => {
  void loadEmojiPickerPanel()
    .then(({ preloadEmojiData }) => preloadEmojiData(language))
    .catch(() => {
      // Opening the picker keeps the normal lazy-load and Frimousse retry path.
    });
};

type EmojiPickerPopoverProps = {
  /** The trigger element the popover is positioned against. */
  anchor: HTMLElement;
  /** Which edge of the anchor the popover lines up with. Defaults to `start`. */
  align?: "start" | "end";
  /**
   * Close when the page scrolls, for an anchor that scrolls away with it.
   * A composer button stays in place while the conversation scrolls.
   */
  closeOnScroll?: boolean;
  /**
   * Gives the focus back when the keyboard leaves the picker, with Escape or
   * Tab. Defaults to the anchor.
   */
  onRestoreFocus?: () => void;
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

const GAP = 6;
const VIEWPORT_MARGIN = 8;

const TABBABLE =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]";

/** Whether Tab, or Shift+Tab, would take the focus out of `container`. */
const tabsOut = (container: HTMLElement, event: KeyboardEvent): boolean => {
  const tabbables = [
    ...container.querySelectorAll<HTMLElement>(TABBABLE),
  ].filter((element) => element.tabIndex >= 0);
  const edge = event.shiftKey ? tabbables[0] : tabbables.at(-1);
  return !edge || event.target === edge;
};

/**
 * Portals the emoji picker to `document.body` so it escapes the virtual-list
 * scroll container, positions it against the trigger (flipping above when
 * there is no room below), and closes on outside-click, Escape, and scroll.
 * Escape, or Tab past its last field, closes it and gives the focus back
 * rather than leaving it at the end of the page.
 */
export const EmojiPickerPopover = ({
  anchor,
  align = "start",
  closeOnScroll = true,
  onRestoreFocus,
  onSelect,
  onClose,
}: EmojiPickerPopoverProps) => {
  const { t } = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Positioned imperatively (not via an inline style prop) so all static
  // styling stays in SCSS — only the two runtime coordinates are set here.
  useLayoutEffect(() => {
    const place = () => {
      const popover = popoverRef.current;
      if (!popover) {
        return;
      }
      const anchorRect = anchor.getBoundingClientRect();
      const { width, height } = popover.getBoundingClientRect();
      const spaceBelow = window.innerHeight - anchorRect.bottom;
      const flipsUp =
        spaceBelow < height + GAP && anchorRect.top > height + GAP;
      const top = flipsUp
        ? anchorRect.top - height - GAP
        : anchorRect.bottom + GAP;
      const left = Math.min(
        Math.max(
          align === "end" ? anchorRect.right - width : anchorRect.left,
          VIEWPORT_MARGIN,
        ),
        window.innerWidth - width - VIEWPORT_MARGIN,
      );
      popover.style.top = `${Math.max(top, VIEWPORT_MARGIN)}px`;
      popover.style.left = `${Math.max(left, VIEWPORT_MARGIN)}px`;
    };
    place();
    // An anchor that stays in place can still move with the window.
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [align, anchor]);

  useEffect(() => {
    // Before unmounting, which would drop a focus left inside to the page.
    const leave = () => {
      if (onRestoreFocus) {
        onRestoreFocus();
      } else {
        anchor.focus();
      }
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const popover = popoverRef.current;
      if (event.key === "Escape") {
        // Handled: the tools panel over the conversation stays open.
        event.preventDefault();
        leave();
      } else if (
        event.key === "Tab" &&
        popover?.contains(event.target as Node) &&
        tabsOut(popover, event)
      ) {
        event.preventDefault();
        leave();
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
    if (closeOnScroll) {
      window.addEventListener("scroll", onScroll, true);
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor, closeOnScroll, onClose, onRestoreFocus]);

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
