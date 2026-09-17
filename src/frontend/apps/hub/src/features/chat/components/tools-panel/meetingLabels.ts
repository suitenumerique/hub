import type { ChatMeeting } from "@/features/drivers/types";

/** Short `DD/MM` date used to label a meeting in the panel lists. */
export const formatMeetingDay = (iso: string, locale?: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
};

/** `HH:MM` start of a meeting. */
export const formatMeetingTime = (iso: string, locale?: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/**
 * Labels a meeting by its day (and its start time with `withTime`) and its
 * name, or `fallback` for a meeting started without one — the
 * `01/09 Réunion du mois` shape of the mockups.
 */
export const formatMeetingLabel = (
  meeting: ChatMeeting,
  fallback: string,
  locale?: string,
  { withTime = false }: { withTime?: boolean } = {},
): string => {
  const day = formatMeetingDay(meeting.startedAt, locale);
  const when = withTime
    ? `${day} ${formatMeetingTime(meeting.startedAt, locale)}`
    : day;
  return `${when} ${meeting.title ?? fallback}`;
};
