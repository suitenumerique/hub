/**
 * The composer's draft: the textarea's text plus the mentions it holds, as
 * ranges of that text. A mention is the person's name typed out; editing
 * inside it turns it back into plain text, as with Element's pills.
 */

export type ComposerMention = {
  start: number;
  end: number;
  userId: string;
  /** The text the range covers: the name inserted for that person. */
  name: string;
};

export type ComposerDraft = {
  text: string;
  /** Sorted and non-overlapping. */
  mentions: readonly ComposerMention[];
};

export const EMPTY_DRAFT: ComposerDraft = { text: "", mentions: [] };

/** `removed` characters at `at` replaced by `added` new ones. */
export type TextChange = { at: number; removed: number; added: number };

/**
 * The change from `previous` to `next` when the caret ends at `caret` and the
 * text after it did not move, as for typing, deleting or pasting. This places
 * a repeated character where it was typed ("aa" + "a"), unlike a plain diff.
 */
export const diffAtCaret = (
  previous: string,
  next: string,
  caret: number,
): TextChange | null => {
  const suffixLength = next.length - caret;
  if (
    suffixLength < 0 ||
    suffixLength > previous.length ||
    previous.slice(previous.length - suffixLength) !== next.slice(caret)
  ) {
    return null;
  }
  const previousHead = previous.length - suffixLength;
  let at = 0;
  while (at < previousHead && at < caret && previous[at] === next[at]) {
    at += 1;
  }
  return { at, removed: previousHead - at, added: caret - at };
};

/** The smallest change from `previous` to `next`: common prefix and suffix. */
export const diffTexts = (previous: string, next: string): TextChange => {
  let at = 0;
  while (
    at < previous.length &&
    at < next.length &&
    previous[at] === next[at]
  ) {
    at += 1;
  }
  let tail = 0;
  while (
    tail < previous.length - at &&
    tail < next.length - at &&
    previous[previous.length - 1 - tail] === next[next.length - 1 - tail]
  ) {
    tail += 1;
  }
  return {
    at,
    removed: previous.length - at - tail,
    added: next.length - at - tail,
  };
};

/** Moves the mentions after a change; a mention the change touches is dropped. */
export const shiftMentions = (
  mentions: readonly ComposerMention[],
  { at, removed, added }: TextChange,
): ComposerMention[] =>
  mentions.flatMap((mention) => {
    if (mention.end <= at) {
      return [mention];
    }
    if (mention.start >= at + removed) {
      const offset = added - removed;
      return [
        {
          ...mention,
          start: mention.start + offset,
          end: mention.end + offset,
        },
      ];
    }
    return [];
  });

/** Keeps the mentions whose range still reads as their name. */
export const validateMentions = (
  mentions: readonly ComposerMention[],
  text: string,
): ComposerMention[] =>
  mentions.filter(
    (mention) => text.slice(mention.start, mention.end) === mention.name,
  );

/** The mention a Backspace at `caret` would cut into. */
export const mentionBefore = (
  mentions: readonly ComposerMention[],
  caret: number,
): ComposerMention | undefined =>
  mentions.find((mention) => mention.start < caret && caret <= mention.end);

/** The mention a Delete at `caret` would cut into. */
export const mentionAfter = (
  mentions: readonly ComposerMention[],
  caret: number,
): ComposerMention | undefined =>
  mentions.find((mention) => mention.start <= caret && caret < mention.end);

/** The mention strictly around `caret`, where the caret should not rest. */
export const mentionAround = (
  mentions: readonly ComposerMention[],
  caret: number,
): ComposerMention | undefined =>
  mentions.find((mention) => mention.start < caret && caret < mention.end);

/** Widens a selection so it holds whole mentions only. */
export const expandRangeToMentions = (
  mentions: readonly ComposerMention[],
  start: number,
  end: number,
): { start: number; end: number } =>
  mentions.reduce(
    (range, mention) =>
      mention.start < range.end && mention.end > range.start
        ? {
            start: Math.min(range.start, mention.start),
            end: Math.max(range.end, mention.end),
          }
        : range,
    { start, end },
  );

/** The draft without its surrounding whitespace, mentions kept in place. */
export const trimDraft = (draft: ComposerDraft): ComposerDraft => {
  const text = draft.text.trim();
  const leading = draft.text.length - draft.text.trimStart().length;
  return {
    text,
    mentions: draft.mentions.flatMap((mention) =>
      mention.start >= leading && mention.end - leading <= text.length
        ? [
            {
              ...mention,
              start: mention.start - leading,
              end: mention.end - leading,
            },
          ]
        : [],
    ),
  };
};

/** `first` and `second` as one draft, `separator` between them. */
export const joinDrafts = (
  first: ComposerDraft,
  separator: string,
  second: ComposerDraft,
): ComposerDraft => {
  const offset = first.text.length + separator.length;
  return {
    text: `${first.text}${separator}${second.text}`,
    mentions: [
      ...first.mentions,
      ...second.mentions.map((mention) => ({
        ...mention,
        start: mention.start + offset,
        end: mention.end + offset,
      })),
    ],
  };
};

export type DraftSegment = { text: string; mention?: ComposerMention };

/** The draft cut into plain text and mentions, in order. */
export const draftSegments = (draft: ComposerDraft): DraftSegment[] => {
  const segments: DraftSegment[] = [];
  let cursor = 0;
  for (const mention of draft.mentions) {
    if (mention.start > cursor) {
      segments.push({ text: draft.text.slice(cursor, mention.start) });
    }
    segments.push({ text: mention.name, mention });
    cursor = mention.end;
  }
  if (cursor < draft.text.length) {
    segments.push({ text: draft.text.slice(cursor) });
  }
  return segments;
};
