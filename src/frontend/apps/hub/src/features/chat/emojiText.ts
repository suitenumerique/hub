/** An emoji, or the text between two. */
export type EmojiTextPart = { text: string; isEmoji: boolean };

let emojiPattern: RegExp | null | undefined;

/**
 * Fully-qualified emojis, sequences included: `©` alone stays text, `©️`
 * is an emoji. Null where the `v` flag is not supported, so the text keeps
 * the system's emojis rather than breaking.
 */
const getEmojiPattern = (): RegExp | null => {
  if (emojiPattern === undefined) {
    try {
      emojiPattern = new RegExp("\\p{RGI_Emoji}", "gv");
    } catch {
      emojiPattern = null;
    }
  }
  return emojiPattern;
};

/** The text cut around its emojis, in order. */
export const splitEmoji = (text: string): EmojiTextPart[] => {
  const pattern = getEmojiPattern();
  if (!pattern) {
    return [{ text, isEmoji: false }];
  }
  const parts: EmojiTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) {
      parts.push({ text: text.slice(cursor, match.index), isEmoji: false });
    }
    parts.push({ text: match[0], isEmoji: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length || parts.length === 0) {
    parts.push({ text: text.slice(cursor), isEmoji: false });
  }
  return parts;
};

/** Whether the text holds an emoji. */
export const hasEmoji = (text: string): boolean =>
  splitEmoji(text).some(({ isEmoji }) => isEmoji);
