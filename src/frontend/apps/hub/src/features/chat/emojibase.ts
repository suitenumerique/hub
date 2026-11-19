/**
 * Emojibase datasets, read by the Frimousse picker and by the composer's
 * `:shortcode` suggestions. Both use the same URLs and cache mode, so the
 * browser serves one from its HTTP cache once the other has fetched it.
 */
// Pinned: another version may change the data's shape, or the characters
// themselves (16 writes 👍 with U+FE0F, unlike the quick reactions, which
// would split a reaction in two), with no error to tell.
export const EMOJIBASE_URL =
  "https://cdn.jsdelivr.net/npm/emojibase-data@18.0.0";

// Locales supported by both the app and Frimousse.
const EMOJIBASE_LOCALES = ["en", "fr", "de", "nl"] as const;
export type EmojibaseLocale = (typeof EMOJIBASE_LOCALES)[number];

export const toEmojibaseLocale = (language: string): EmojibaseLocale => {
  const lang = language.slice(0, 2).toLowerCase();
  return (EMOJIBASE_LOCALES as readonly string[]).includes(lang)
    ? (lang as EmojibaseLocale)
    : "en";
};

/** Fetches one Emojibase file, from the HTTP cache when it holds it. */
export const fetchEmojibase = async (
  path: string,
  signal?: AbortSignal,
): Promise<Response> => {
  const response = await fetch(`${EMOJIBASE_URL}/${path}`, {
    cache: "force-cache",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Could not load Emojibase ${path}.`);
  }
  return response;
};
