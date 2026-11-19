import { type RefObject, useLayoutEffect } from "react";

/**
 * Scrolls a suggestion list so its selected row shows. Only the list
 * scrolls: `scrollIntoView` could move the timeline too.
 */
export const useSelectedOptionInView = (
  listRef: RefObject<HTMLElement | null>,
  selectedIndex: number,
  items: readonly unknown[],
) => {
  useLayoutEffect(() => {
    const list = listRef.current;
    const option = list?.children[selectedIndex] as HTMLElement | undefined;
    if (!list || !option) {
      return;
    }
    if (option.offsetTop < list.scrollTop) {
      list.scrollTop = option.offsetTop;
    } else if (
      option.offsetTop + option.offsetHeight >
      list.scrollTop + list.clientHeight
    ) {
      list.scrollTop =
        option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [items, listRef, selectedIndex]);
};
