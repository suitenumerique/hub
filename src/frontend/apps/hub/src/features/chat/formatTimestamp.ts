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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getCalendarDay = (date: Date, timeZone?: string): number => {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return Date.UTC(getPart("year"), getPart("month") - 1, getPart("day"));
};

/** Whether two message timestamps belong to the same local calendar day. */
export const isSameChatDay = (
  firstIso: string,
  secondIso: string,
  timeZone?: string,
): boolean => {
  const first = new Date(firstIso);
  const second = new Date(secondIso);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) {
    return false;
  }

  return getCalendarDay(first, timeZone) === getCalendarDay(second, timeZone);
};

/**
 * Format the timestamp shown beside the author of a received-message group:
 * time only today, a localized "Yesterday" plus time for the previous day,
 * and the complete numeric date plus time for older messages.
 */
export const formatChatGroupTimestamp = (
  iso: string,
  locale?: string,
  timeZone?: string,
  now = new Date(),
): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const time = formatChatTime(iso, locale, timeZone);
  const dayDifference =
    (getCalendarDay(now, timeZone) - getCalendarDay(date, timeZone)) /
    DAY_IN_MS;

  if (dayDifference === 0) {
    return time;
  }

  if (dayDifference === 1) {
    const yesterday = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
    }).format(-1, "day");
    const localizedYesterday =
      yesterday.charAt(0).toLocaleUpperCase(locale) + yesterday.slice(1);
    return `${localizedYesterday} · ${time}`;
  }

  const fullDate = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(date);
  return `${fullDate} · ${time}`;
};
