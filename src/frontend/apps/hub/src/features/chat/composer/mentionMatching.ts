/** Someone the composer can mention. */
export type MentionCandidate = {
  id: string;
  /** Shown in the suggestions; carries the id when two members share a name. */
  name: string;
  /** Written into the message. */
  rawName: string;
  avatarUrl?: string;
};

/** Element's limit of suggestions per provider. */
const MAX_SUGGESTIONS = 20;

const COMBINING_MARKS = /[̀-ͯ]/g;
// Soft hyphen, zero-width characters and direction marks.
const HIDDEN_CHARS = /[­​-‏‪-‮⁠-⁯﻿]/g;

/**
 * Text as compared for suggestions, like Element's `removeHiddenChars`: case,
 * accents, spaces and invisible characters do not count ("@elod" finds
 * "Élodie", "@jeanm" finds "Jean Martin").
 */
export const normalizeForMatch = (text: string): string =>
  text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(HIDDEN_CHARS, "")
    .replace(/\s+/g, "")
    .toLowerCase();

export type MentionIndex = {
  candidate: MentionCandidate;
  /** Name, then id without its `@`: a name match ranks first. */
  keys: [string, string];
}[];

export const buildMentionIndex = (
  candidates: readonly MentionCandidate[],
): MentionIndex =>
  candidates.map((candidate) => ({
    candidate,
    keys: [
      normalizeForMatch(candidate.name),
      normalizeForMatch(candidate.id.replace(/^@/, "")),
    ],
  }));

/**
 * The candidates matching `query`, ranked as Element does: earliest match
 * first, a name before an id, then whoever spoke last. An empty query (a lone
 * `@`) lists everyone, recent speakers first.
 */
export const rankMentionCandidates = (
  index: MentionIndex,
  query: string,
  recentSpeakerIds: readonly string[],
): MentionCandidate[] => {
  const normalizedQuery = normalizeForMatch(query);
  const recency = new Map(recentSpeakerIds.map((id, rank) => [id, rank]));
  const recencyOf = (id: string) => recency.get(id) ?? Infinity;
  return index
    .flatMap(({ candidate, keys }) => {
      const [position, keyRank] = keys.reduce<[number, number]>(
        (best, key, rank) => {
          const found = key.indexOf(normalizedQuery);
          return found >= 0 && found < best[0] ? [found, rank] : best;
        },
        [Infinity, 0],
      );
      return position === Infinity ? [] : [{ candidate, position, keyRank }];
    })
    .sort(
      (first, second) =>
        first.position - second.position ||
        first.keyRank - second.keyRank ||
        recencyOf(first.candidate.id) - recencyOf(second.candidate.id) ||
        first.candidate.name.localeCompare(second.candidate.name),
    )
    .slice(0, MAX_SUGGESTIONS)
    .map(({ candidate }) => candidate);
};
