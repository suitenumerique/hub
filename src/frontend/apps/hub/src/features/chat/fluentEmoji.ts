/**
 * Resolves an emoji character to its Fluent UI drawing (flat style).
 *
 * The drawings are served by the Hub itself, copied from the pinned
 * `@lobehub/fluent-emoji-flat` by `scripts/copy-emoji-assets.mjs`, which
 * names them as `emojiToCodepoints` does:
 *
 *   👋   → 1f44b.svg
 *   👋🏿  → 1f44b-1f3ff.svg
 *   1️⃣   → 0031-20e3.svg   (codepoints zero-padded to 4 hex digits)
 */

const FLUENT_EMOJI_PATH = "/emoji/fluent";

/**
 * Derives the hyphen-joined codepoint sequence used in Fluent asset filenames:
 * iterate Unicode code points, hex-encode, zero-pad each to 4 digits, drop the
 * `fe0f` variation selector, keep `200d` zero-width joiners. Without `fe0f`,
 * an emoji sent with or without it finds the same drawing.
 */
export const emojiToCodepoints = (emoji: string): string =>
  [...emoji]
    .map((char) => char.codePointAt(0)!.toString(16).padStart(4, "0"))
    .filter((codepoint) => codepoint !== "fe0f")
    .join("-");

/** The URL of the Fluent drawing of a native emoji character. */
export const fluentEmojiUrl = (emoji: string): string =>
  `${FLUENT_EMOJI_PATH}/${emojiToCodepoints(emoji)}.svg`;
