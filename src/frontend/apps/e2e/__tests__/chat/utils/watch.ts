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

export type WatchedTexts = {
  /** Each text shown in turn, a change recorded once, the first one included. */
  history: () => Promise<string[]>;
};

/**
 * Records the texts of the elements matching `selector` in `root` through every
 * render, joined with " | ": a value shown for a single frame, such as a count
 * jumping back and forth, is recorded too.
 */
export const watchTexts = async (
  root: Locator,
  selector: string,
): Promise<WatchedTexts> => {
  const key = `__watch_${Math.random().toString(36).slice(2)}`;
  await root.evaluate(
    (element, { key, selector }) => {
      const history: string[] = [];
      (window as unknown as Record<string, unknown>)[key] = history;
      const check = () => {
        const text = Array.from(element.querySelectorAll(selector))
          .map((match) => match.textContent ?? "")
          .join(" | ");
        if (history.at(-1) !== text) history.push(text);
      };
      check();
      new MutationObserver(check).observe(element, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    },
    { key, selector },
  );
  return {
    history: () =>
      root.evaluate(
        (_element, key) => [
          ...((window as unknown as Record<string, unknown>)[key] as string[]),
        ],
        key,
      ),
  };
};
