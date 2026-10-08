import type { ComposerMention } from "./composerDraft";

/** What may precede an `@` that starts a mention, besides the start of the text. */
const BOUNDARY = /[\s([{"'«“‘]/;

/** An `@` being typed: where it stands and the text typed after it. */
export type MentionTrigger = { start: number; query: string };

/**
 * The mention being typed before `caret`, as Element detects it: an `@` at
 * the start of a word (never in `name@domain`), followed by no whitespace.
 */
export const findMentionTrigger = (
  text: string,
  caret: number,
  mentions: readonly ComposerMention[],
): MentionTrigger | null => {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf("@");
  if (start < 0) {
    return null;
  }
  const query = before.slice(start + 1);
  if (/\s/.test(query) || (start > 0 && !BOUNDARY.test(before[start - 1]))) {
    return null;
  }
  return mentions.some(
    (mention) => mention.start < caret && mention.end > start,
  )
    ? null
    : { start, query };
};
