const DIACRITICS = /\p{Diacritic}/gu;

/** Canonical text used by every local conversation comparison. */
export const normalizeChatSearchText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

/**
 * Relevance bucket for one candidate: exact first, then a leading/word
 * prefix, then a partial match. `null` means no match.
 */
export const chatSearchMatchRank = (
  value: string,
  normalizedQuery: string,
): number | null => {
  const normalizedValue = normalizeChatSearchText(value);
  if (!normalizedValue || !normalizedQuery) {
    return null;
  }
  if (normalizedValue === normalizedQuery) {
    return 0;
  }
  if (
    normalizedValue.startsWith(normalizedQuery) ||
    normalizedValue.split(" ").some((word) => word.startsWith(normalizedQuery))
  ) {
    return 1;
  }
  const terms = normalizedQuery.split(" ");
  return terms.every((term) => normalizedValue.includes(term)) ? 2 : null;
};

export const compareChatSearchText = (left: string, right: string): number => {
  const normalizedComparison = normalizeChatSearchText(left).localeCompare(
    normalizeChatSearchText(right),
  );
  return normalizedComparison || left.localeCompare(right);
};
