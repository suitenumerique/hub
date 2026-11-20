import { useCallback, useReducer } from "react";

import { fluentEmojiUrl } from "../fluentEmoji";

// Emojis without a Fluent drawing (newer than the set, or never drawn): known
// once, every later rendering shows the system's emoji right away.
const missingDrawings = new Set<string>();

/**
 * The URL of an emoji's Fluent drawing, or null once it failed to load, and
 * the `onError` to give the image.
 */
export const useFluentEmojiUrl = (emoji: string) => {
  const url = fluentEmojiUrl(emoji);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const onError = useCallback(() => {
    missingDrawings.add(url);
    rerender();
  }, [url]);
  return { url: missingDrawings.has(url) ? null : url, onError };
};
