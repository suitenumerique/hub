import type { Locator } from "@playwright/test";

export type WatchedText = {
  /** Times the text left the element after it first showed. */
  disappearances: () => Promise<number>;
};

/**
 * Watches the DOM of `root` for `text`, through every render: a flicker too
 * short for an assertion to see, such as a reload briefly dropping a row, is
 * still counted.
 */
export const watchText = async (
  root: Locator,
  text: string,
): Promise<WatchedText> => {
  const key = `__watch_${Math.random().toString(36).slice(2)}`;
  await root.evaluate(
    (element, { key, text }) => {
      const state = { shown: false, disappearances: 0 };
      (window as unknown as Record<string, unknown>)[key] = state;
      const check = () => {
        const shown = element.textContent?.includes(text) ?? false;
        if (state.shown && !shown) state.disappearances += 1;
        state.shown = shown;
      };
      new MutationObserver(check).observe(element, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    },
    { key, text },
  );
  return {
    disappearances: () =>
      root.evaluate(
        (_element, key) =>
          (
            (window as unknown as Record<string, unknown>)[key] as {
              disappearances: number;
            }
          ).disappearances,
        key,
      ),
  };
};
