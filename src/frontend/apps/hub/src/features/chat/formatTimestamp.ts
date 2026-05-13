/**
 * Format an ISO 8601 message timestamp as a short HH:MM string in the user's
 * locale. Returns the raw input on parse failure so the UI never shows
 * "Invalid Date" — useful while the backend is still settling on a format.
 */
export const formatChatTime = (
  iso: string,
  locale?: string,
  timeZone?: string,
): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
};
