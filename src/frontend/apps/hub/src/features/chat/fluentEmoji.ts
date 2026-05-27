/**
 * Resolves an emoji character to a Fluent UI emoji asset URL.
 *
 * Assets come from the codepoint-keyed `shuding/fluentui-emoji-unicode` mirror,
 * served by jsDelivr. The CDN ref is pinned to an immutable commit — an
 * unpinned `gh/` URL tracks the default branch and could break silently.
 *
 * This is the single indirection point for emoji assets: moving to
 * self-hosted assets (required before production, for sovereignty / RGPD)
 * only changes this file.
 *
 *   👋   → 1f44b_3d.png
 *   👋🏿  → 1f44b-1f3ff_3d.png
 *   1️⃣   → 0031-20e3_3d.png   (codepoints zero-padded to 4 hex digits)
 */

const CDN_BASE =
  "https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode@7a40f1a2d064d76e436813edc0f09b6c8cde5da8/assets";

export type FluentEmojiStyle = "3d" | "color" | "flat" | "high-contrast";

/**
 * Derives the hyphen-joined codepoint sequence used in Fluent asset filenames:
 * iterate Unicode code points, hex-encode, zero-pad each to 4 digits, drop the
 * `fe0f` variation selector, keep `200d` zero-width joiners.
 */
export const emojiToCodepoints = (emoji: string): string =>
  [...emoji]
    .map((char) => char.codePointAt(0)!.toString(16).padStart(4, "0"))
    .filter((codepoint) => codepoint !== "fe0f")
    .join("-");

/** Builds the Fluent UI emoji asset URL for a native emoji character. */
export const fluentEmojiUrl = (
  emoji: string,
  style: FluentEmojiStyle = "3d",
): string => {
  const extension = style === "3d" ? "png" : "svg";
  return `${CDN_BASE}/${emojiToCodepoints(emoji)}_${style}.${extension}`;
};
