import {
  KeyboardEvent,
  PointerEvent,
  RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import {
  applyToolsPanelWidth,
  clampToolsPanelWidth,
  loadToolsPanelWidth,
  maxToolsPanelWidth,
  saveToolsPanelWidth,
  TOOLS_PANEL_DEFAULT_WIDTH,
  TOOLS_PANEL_MIN_WIDTH,
} from "./toolsPanelWidth";

const KEYBOARD_STEP = 16;

type ToolsPanelResizeHandleProps = {
  /** The chat view, whose CSS sizes the panel from the width picked here. */
  viewRef: RefObject<HTMLElement | null>;
  panelId: string;
};

/**
 * Resizes the tools panel from its left edge, as Docs does its left panel: by
 * dragging, double-clicking to go back to the default width, or with the
 * arrow keys as a window splitter.
 */
export const ToolsPanelResizeHandle = ({
  viewRef,
  panelId,
}: ToolsPanelResizeHandleProps) => {
  const { t } = useTranslation();
  // The width picked, kept when the window is too narrow to show it.
  const [width, setWidth] = useState(loadToolsPanelWidth);
  const [viewWidth, setViewWidth] = useState(0);
  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const observer = new ResizeObserver(() => setViewWidth(view.clientWidth));
    observer.observe(view);
    setViewWidth(view.clientWidth);
    return () => {
      observer.disconnect();
      // Closed while dragging: the view must not stay in its resizing state.
      view.removeAttribute("data-panel-resizing");
    };
  }, [viewRef]);

  useLayoutEffect(() => {
    if (viewRef.current) {
      applyToolsPanelWidth(viewRef.current, width);
    }
  }, [viewRef, width]);

  const shownWidth = clampToolsPanelWidth(width, viewWidth);
  const maxWidth = maxToolsPanelWidth(viewWidth);
  // Read out as Docs does its left panel, rather than a bare number.
  const ratio =
    maxWidth > TOOLS_PANEL_MIN_WIDTH
      ? (shownWidth - TOOLS_PANEL_MIN_WIDTH) /
        (maxWidth - TOOLS_PANEL_MIN_WIDTH)
      : 0.5;
  let widthText = t("Panel width: wide");
  if (ratio < 1 / 3) {
    widthText = t("Panel width: narrow");
  } else if (ratio < 2 / 3) {
    widthText = t("Panel width: medium");
  }

  const commit = (next: number) => {
    setWidth(next);
    saveToolsPanelWidth(next);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    // No text selection while dragging.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startWidth: shownWidth,
      width: shownWidth,
    };
    viewRef.current?.setAttribute("data-panel-resizing", "true");
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    // The panel is on the right: moving left widens it.
    drag.width = clampToolsPanelWidth(
      drag.startWidth + drag.startX - event.clientX,
      viewWidth,
    );
    setWidth(drag.width);
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    dragRef.current = null;
    viewRef.current?.removeAttribute("data-panel-resizing");
    // A click without a move keeps the width picked before.
    if (drag.width !== drag.startWidth) {
      saveToolsPanelWidth(drag.width);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowLeft: shownWidth + KEYBOARD_STEP,
      ArrowRight: shownWidth - KEYBOARD_STEP,
      Home: TOOLS_PANEL_MIN_WIDTH,
      End: maxWidth,
    };
    if (!(event.key in steps)) {
      return;
    }
    event.preventDefault();
    commit(clampToolsPanelWidth(steps[event.key], viewWidth));
  };

  return (
    <div
      className="hub__chat-view__resize-handle"
      role="separator"
      tabIndex={0}
      aria-label={t("Resize panel")}
      aria-controls={panelId}
      aria-orientation="vertical"
      aria-valuemin={TOOLS_PANEL_MIN_WIDTH}
      aria-valuemax={maxWidth}
      aria-valuenow={shownWidth}
      aria-valuetext={widthText}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={() => commit(TOOLS_PANEL_DEFAULT_WIDTH)}
      onKeyDown={handleKeyDown}
    />
  );
};
