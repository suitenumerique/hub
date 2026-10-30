import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Asks again when a virtualized list comes back to its edge, after a failed
 * load for instance: `onEdgeChange` goes to Virtuoso's `atTopStateChange` or
 * `atBottomStateChange`, `scrollHandlers` to an element around the list.
 * Edge reports before the person scrolls are ignored, as in the conversation
 * timeline: on a slow device Virtuoso reports an edge before the list is laid
 * out, and before a list opened at its end has scrolled there, which loaded a
 * page nobody asked for. A list too short to scroll loads through
 * `startReached` / `endReached`. Another `listKey` starts over.
 */
export const useListEdgeReturn = (onReturn: () => void, listKey: string) => {
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [listKey]);
  const onEdgeChange = useCallback(
    (atEdge: boolean) => {
      if (atEdge && hasScrolledRef.current) {
        onReturn();
      }
    },
    [onReturn],
  );
  const scrollHandlers = useMemo(() => {
    const markScrolled = () => {
      hasScrolledRef.current = true;
    };
    return {
      onWheel: markScrolled,
      onTouchMove: markScrolled,
      onPointerDown: markScrolled,
      onKeyDown: markScrolled,
    };
  }, []);
  return { onEdgeChange, scrollHandlers };
};
