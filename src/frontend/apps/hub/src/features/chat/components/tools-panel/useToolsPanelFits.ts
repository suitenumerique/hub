import { RefObject, useLayoutEffect, useState } from "react";

import { toolsPanelFits } from "./toolsPanelWidth";

/**
 * Tells whether the tools panel fits beside the conversation of the chat view.
 * Only crossing that limit renders again, not every change of the window's
 * width. The width itself is applied by the resize handle, shown with the
 * panel whenever it fits.
 */
export const useToolsPanelFits = (
  viewRef: RefObject<HTMLElement | null>,
): boolean => {
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    let current: boolean | undefined;
    let snapFrame = 0;
    const update = () => {
      const next = toolsPanelFits(view.clientWidth);
      if (next === current) {
        return;
      }
      if (current !== undefined) {
        // The panel changes place at once, without sliding in or out.
        view.dataset.panelSnapping = "true";
        cancelAnimationFrame(snapFrame);
        snapFrame = requestAnimationFrame(() => {
          snapFrame = requestAnimationFrame(() => {
            delete view.dataset.panelSnapping;
          });
        });
      }
      current = next;
      setFits(next);
    };
    const observer = new ResizeObserver(update);
    observer.observe(view);
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(snapFrame);
    };
  }, [viewRef]);

  return fits;
};
