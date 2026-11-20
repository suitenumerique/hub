/**
 * Emojibase datasets, read by the Frimousse picker and by the composer's
 * `:shortcode` suggestions. Both use the same URLs and cache mode, so the
 * browser serves one from its HTTP cache once the other has fetched it.
 *
 * The Hub serves them, copied by `scripts/copy-emoji-assets.mjs` from the
 * pinned `emojibase-data` (another version may change the data's shape, or
 * the characters themselves, with no error to tell) and limited to the
 * emojis that have a Fluent drawing.
 */
export const EMOJIBASE_URL = "/emoji/emojibase";

// Locales supported by both the app and Frimousse, and copied by
// `scripts/copy-emoji-assets.mjs`.
const EMOJIBASE_LOCALES = ["en", "fr", "de", "nl"] as const;
export type EmojibaseLocale = (typeof EMOJIBASE_LOCALES)[number];

export const toEmojibaseLocale = (language: string): EmojibaseLocale => {
  const lang = language.slice(0, 2).toLowerCase();
  return (EMOJIBASE_LOCALES as readonly string[]).includes(lang)
    ? (lang as EmojibaseLocale)
    : "en";
};

/**
 * Fetches one Emojibase file, from the HTTP cache while it is fresh. The URL
 * carries no version: a stale copy is checked against the server, so the
 * data of a new deployment reaches the browser.
 */
export const fetchEmojibase = async (
  path: string,
  signal?: AbortSignal,
): Promise<Response> => {
  const response = await fetch(`${EMOJIBASE_URL}/${path}`, { signal });
  if (!response.ok) {
    throw new Error(`Could not load Emojibase ${path}.`);
  }
  return response;
};
