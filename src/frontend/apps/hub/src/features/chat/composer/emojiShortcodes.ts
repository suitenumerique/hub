import type { ComposerMention } from "./composerDraft";

/**
 * One emoji with the shortcodes it is typed with, such as `+1` and
 * `thumbsup`, and the keywords it is also found by, such as `mdr`.
 */
export type ShortcodeEmoji = {
  emoji: string;
  shortcodes: readonly string[];
  keywords?: readonly string[];
};

/**
 * An emoji offered for the shortcode being typed, with the part typed. Found
 * by a keyword, it shows its first shortcode with nothing in bold.
 */
export type ShortcodeMatch = {
  emoji: string;
  shortcode: string;
  /** Where the typed text starts in `shortcode`. */
  matchStart: number;
  matchLength: number;
  byKeyword?: boolean;
};

/** A `:shortcode` being typed: where its `:` stands and the text after it. */
export type ShortcodeTrigger = { start: number; query: string };

/** Characters typed after the `:` before anything is offered. */
export const MIN_SHORTCODE_QUERY = 2;

const MAX_SHORTCODE_MATCHES = 10;

/** Shortcode characters, accented letters included (`:cœur`). */
const SHORTCODE_CHARS = "[\\p{L}\\p{N}_+-]";

/**
 * The `:` opening a shortcode: glued to a word (`toto:smile`) but not to a
 * number, so the minutes of a time such as `12:10` offer no emoji.
 */
const OPENING_COLON = "(?<!\\p{N}):";

/**
 * An opening `:`, shortcode characters, then the closing `:` if typed, up to
 * the caret. A URL matches nothing.
 */
const TRIGGER = new RegExp(`${OPENING_COLON}(${SHORTCODE_CHARS}*):?$`, "u");

/** Each `:shortcode:` written in full in a text. */
const CLOSED_SHORTCODES = new RegExp(
  `${OPENING_COLON}(${SHORTCODE_CHARS}+):`,
  "gu",
);

/** The rest of a shortcode after the caret, up to its closing `:`. */
const SHORTCODE_REST = new RegExp(`^${SHORTCODE_CHARS}*:`, "u");

/**
 * How far the shortcode around `caret` goes on after it, its closing `:`
 * included, or 0 when no `:` closes it.
 */
export const shortcodeRestLength = (text: string, caret: number): number =>
  SHORTCODE_REST.exec(text.slice(caret))?.[0].length ?? 0;

/** The shortcode being typed before `caret`. */
export const findShortcodeTrigger = (
  text: string,
  caret: number,
  mentions: readonly ComposerMention[],
): ShortcodeTrigger | null => {
  const match = TRIGGER.exec(text.slice(0, caret));
  if (!match) {
    return null;
  }
  const start = match.index;
  return mentions.some(
    (mention) => mention.start < caret && mention.end > start,
  )
    ? null
    : { start, query: match[1] };
};

/**
 * Case and accents do not matter (`:Cœur` finds `coeur_rouge`), and `-`
 * stands for `_`, as in `thong-sandal`.
 */
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/-/g, "_");

/** Finds the emoji of a shortcode written in full, in any case or accent. */
export type ShortcodeLookup = (shortcode: string) => string | undefined;

export const shortcodeLookup = (
  emojis: readonly ShortcodeEmoji[],
): ShortcodeLookup => {
  const byShortcode = new Map<string, string>();
  for (const { emoji, shortcodes } of emojis) {
    for (const shortcode of shortcodes) {
      const key = normalize(shortcode);
      if (!byShortcode.has(key)) {
        byShortcode.set(key, emoji);
      }
    }
  }
  return (shortcode) => byShortcode.get(normalize(shortcode));
};

/**
 * The `:shortcode:` just closed before `caret`, as Slack and Element turn it
 * into its emoji, or null.
 */
export const findClosedShortcode = (
  text: string,
  caret: number,
  mentions: readonly ComposerMention[],
  lookup: ShortcodeLookup,
): { start: number; emoji: string } | null => {
  const trigger = findShortcodeTrigger(text, caret, mentions);
  if (!trigger?.query || text[caret - 1] !== ":") {
    return null;
  }
  const emoji = lookup(trigger.query);
  return emoji ? { start: trigger.start, emoji } : null;
};

/**
 * The text with each known `:shortcode:` replaced by its emoji. `precededBy`
 * is what stands before the text, so that one at its start stays after a
 * number, as `12` then a pasted `:tada:`.
 */
export const replaceShortcodes = (
  text: string,
  lookup: ShortcodeLookup,
  precededBy = "",
) =>
  text.replace(
    CLOSED_SHORTCODES,
    (written, shortcode: string, offset: number) => {
      if (offset === 0 && /\p{N}$/u.test(precededBy)) {
        return written;
      }
      return lookup(shortcode) ?? written;
    },
  );

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
 * `heart` comes before `headphones`. Emojis found by a keyword come last, in
 * their own order, as do ties.
 */
const compareMatches = (first: ShortcodeMatch, second: ShortcodeMatch) => {
  if (first.byKeyword || second.byKeyword) {
    return Number(first.byKeyword ?? false) - Number(second.byKeyword ?? false);
  }
  return (
    first.matchStart - second.matchStart ||
    first.shortcode.length - second.shortcode.length
  );
};

/** Whether a word of one of the keywords starts with `needle`. */
const hasKeyword = (keywords: readonly string[], needle: string) =>
  keywords.some(
    (keyword) =>
      wordStart(normalize(keyword).replace(/\s+/g, "_"), needle) >= 0,
  );

/**
 * The emojis whose shortcode has a word starting with `query`, as in
 * Element: `san` offers `santa` and `sandal`, then `thong_sandal`. Each emoji
 * shows once, with its best matching shortcode. Then those found by a word
 * of their keywords, as the picker's search: `mdr` offers 😄 😆 🤣 😂.
 * `emojis` come in the picker's order.
 */
export const matchShortcodes = (
  emojis: readonly ShortcodeEmoji[],
  query: string,
  limit = MAX_SHORTCODE_MATCHES,
): ShortcodeMatch[] => {
  const needle = normalize(query);
  const matches: ShortcodeMatch[] = [];
  for (const { emoji, shortcodes, keywords = [] } of emojis) {
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
    if (!best && shortcodes.length > 0 && hasKeyword(keywords, needle)) {
      best = {
        emoji,
        shortcode: shortcodes[0],
        matchStart: 0,
        matchLength: 0,
        byKeyword: true,
      };
    }
    if (best) {
      matches.push(best);
    }
  }
  return matches.sort(compareMatches).slice(0, limit);
};
