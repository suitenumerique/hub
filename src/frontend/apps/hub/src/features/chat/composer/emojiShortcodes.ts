import type { ComposerMention } from "./composerDraft";

/** One emoji with the shortcodes it is typed with, such as `+1` and `thumbsup`. */
export type ShortcodeEmoji = { emoji: string; shortcodes: readonly string[] };

/** An emoji offered for the shortcode being typed, with the part typed. */
export type ShortcodeMatch = {
  emoji: string;
  shortcode: string;
  /** Where the typed text starts in `shortcode`. */
  matchStart: number;
  matchLength: number;
};

/** A `:shortcode` being typed: where its `:` stands and the text after it. */
export type ShortcodeTrigger = { start: number; query: string };

/** Characters typed after the `:` before anything is offered. */
export const MIN_SHORTCODE_QUERY = 2;

const MAX_SHORTCODE_MATCHES = 10;

/**
 * A `:` at the start of a word (never in `10:30` or a URL), shortcode
 * characters, then the closing `:` if typed, up to the caret.
 */
const TRIGGER = /(^|[\s([{"'«“‘]):([\w+-]*):?$/;

/** The shortcode being typed before `caret`, as Element detects it. */
export const findShortcodeTrigger = (
  text: string,
  caret: number,
  mentions: readonly ComposerMention[],
): ShortcodeTrigger | null => {
  const match = TRIGGER.exec(text.slice(0, caret));
  if (!match) {
    return null;
  }
  const start = match.index + match[1].length;
  return mentions.some(
    (mention) => mention.start < caret && mention.end > start,
  )
    ? null
    : { start, query: match[2] };
};

/** Case does not matter, and `-` stands for `_`, as in `thong-sandal`. */
const normalize = (value: string) => value.toLowerCase().replace(/-/g, "_");

/** Where `query` starts a word of `shortcode`, or -1. */
const wordStart = (shortcode: string, query: string): number => {
  let index = shortcode.indexOf(query);
  while (index > 0 && shortcode[index - 1] !== "_") {
    index = shortcode.indexOf(query, index + 1);
  }
  return index;
};

/**
 * Element's order: the text found earliest, then the shortest shortcode, so
 * `heart` comes before `headphones`. Ties keep the emojis' own order.
 */
const compareMatches = (first: ShortcodeMatch, second: ShortcodeMatch) =>
  first.matchStart - second.matchStart ||
  first.shortcode.length - second.shortcode.length;

/**
 * The emojis whose shortcode has a word starting with `query`, as in
 * Element: `san` offers `santa` and `sandal`, then `thong_sandal`. Each emoji
 * shows once, with its best matching shortcode. `emojis` come in the
 * picker's order.
 */
export const matchShortcodes = (
  emojis: readonly ShortcodeEmoji[],
  query: string,
  limit = MAX_SHORTCODE_MATCHES,
): ShortcodeMatch[] => {
  const needle = normalize(query);
  const matches: ShortcodeMatch[] = [];
  for (const { emoji, shortcodes } of emojis) {
    let best: ShortcodeMatch | undefined;
    for (const shortcode of shortcodes) {
      const matchStart = wordStart(normalize(shortcode), needle);
      const match = {
        emoji,
        shortcode,
        matchStart,
        matchLength: needle.length,
      };
      if (matchStart >= 0 && (!best || compareMatches(match, best) < 0)) {
        best = match;
      }
    }
    if (best) {
      matches.push(best);
    }
  }
  return matches.sort(compareMatches).slice(0, limit);
};
