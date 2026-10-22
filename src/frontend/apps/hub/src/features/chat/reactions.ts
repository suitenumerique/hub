import type { ChatReaction } from "@/features/drivers/types";

import { emojiToCodepoints } from "./fluentEmoji";

/**
 * Pure toggle of the current user's reaction with `emoji` against an aggregated
 * reaction list. Shared by the Matrix mapping and the `useToggleReaction`
 * optimistic update so the two can never drift.
 *
 * Reactions are matched by normalized emoji identity (`emojiToCodepoints`,
 * which drops the `fe0f` variation selector) so variant encodings of the same
 * emoji collapse onto one chip instead of creating a duplicate.
 *
 * Returns a new array (and new objects for the touched reaction); the input is
 * never mutated. New reactions are appended, keeping insertion order stable.
 */
export const toggleReaction = (
  reactions: ChatReaction[],
  emoji: string,
): ChatReaction[] => {
  const key = emojiToCodepoints(emoji);
  const index = reactions.findIndex(
    (reaction) => emojiToCodepoints(reaction.emoji) === key,
  );

  if (index === -1) {
    // The emoji is not on the message yet — add it as the current user's.
    return [...reactions, { emoji, count: 1, reactedByMe: true }];
  }

  const existing = reactions[index];

  if (!existing.reactedByMe) {
    // Others reacted with it, but not the current user — join in.
    return reactions.map((reaction, i) =>
      i === index
        ? { ...reaction, count: reaction.count + 1, reactedByMe: true }
        : reaction,
    );
  }

  // The current user already reacted — remove their reaction, dropping the
  // whole entry when it was the last one.
  const count = existing.count - 1;
  if (count <= 0) {
    return reactions.filter((_, i) => i !== index);
  }
  return reactions.map((reaction, i) =>
    i === index ? { ...reaction, count, reactedByMe: false } : reaction,
  );
};

/**
 * `next` without moving the chips `previous` already shows: they keep their
 * order between them, so a count change never moves one. Emojis appearing
 * take their place from `next`, which lists them by first appearance: a new
 * reaction comes last, an older one decrypted late comes back to its place.
 */
export const keepReactionOrder = (
  previous: ChatReaction[],
  next: ChatReaction[],
): ChatReaction[] => {
  if (previous.length === 0) {
    return next;
  }
  const nextByKey = new Map(
    next.map((reaction) => [emojiToCodepoints(reaction.emoji), reaction]),
  );
  const shown = previous
    .map((reaction) => emojiToCodepoints(reaction.emoji))
    .filter((key) => nextByKey.has(key));
  const shownKeys = new Set(shown);
  let slot = 0;
  return next.map((reaction) =>
    shownKeys.has(emojiToCodepoints(reaction.emoji))
      ? nextByKey.get(shown[slot++])!
      : reaction,
  );
};
