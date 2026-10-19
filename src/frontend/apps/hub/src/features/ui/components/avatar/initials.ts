/**
 * Tchap display names end with the person's organisation between brackets,
 * e.g. "Nathan Panchout [Melde]". It is not part of the person's initials.
 */
const TRAILING_QUALIFIER = /\s*[[(][^\])]*[\])]\s*$/u;

/** First letter or digit of a word, skipping punctuation such as "@". */
const firstCharacter = (word: string): string | undefined =>
  word.match(/[\p{L}\p{N}]/u)?.[0];

/** Initials of the first and last words of a name: "Ada Lovelace" → "AL". */
export const deriveInitials = (label: string): string => {
  const name = label.replace(TRAILING_QUALIFIER, "").trim() || label.trim();
  const letters = name
    .split(/\s+/)
    .map(firstCharacter)
    .filter((letter): letter is string => letter !== undefined);
  if (letters.length === 0) return "";
  if (letters.length === 1) return letters[0].toUpperCase();
  return (letters[0] + letters[letters.length - 1]).toUpperCase();
};
