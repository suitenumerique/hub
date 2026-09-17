import type { ChatMeeting } from "./types";

const MINUTE = 60 * 1000;

/**
 * Meet exposes no "call over" signal, so a meeting nobody closed is treated as
 * over after a while: 3 hours for one without a planned duration, or its
 * planned duration plus this much overtime.
 */
export const UNPLANNED_MEETING_WINDOW_MS = 3 * 60 * MINUTE;
export const MEETING_MAX_OVERTIME_MS = 6 * 60 * MINUTE;

export type MeetingStatus = "upcoming" | "ongoing" | "ended";

export type MeetingProgress = {
  /** Time since the planned start, 0 before it. */
  elapsedMs: number;
  plannedMs?: number;
  /** The planned duration is over but the meeting was not closed. */
  isOverdue: boolean;
};

const startOf = (meeting: ChatMeeting): number => Date.parse(meeting.startedAt);

const plannedMsOf = (meeting: ChatMeeting): number | undefined =>
  meeting.plannedDurationMinutes && meeting.plannedDurationMinutes > 0
    ? meeting.plannedDurationMinutes * MINUTE
    : undefined;

export const getMeetingStatus = (
  meeting: ChatMeeting,
  now: number = Date.now(),
): MeetingStatus => {
  if (meeting.endedAt) {
    return "ended";
  }
  const start = startOf(meeting);
  if (Number.isNaN(start)) {
    return "ended";
  }
  if (now < start) {
    return "upcoming";
  }
  const plannedMs = plannedMsOf(meeting);
  const limit =
    plannedMs === undefined
      ? start + UNPLANNED_MEETING_WINDOW_MS
      : start + plannedMs + MEETING_MAX_OVERTIME_MS;
  return now < limit ? "ongoing" : "ended";
};

export const isMeetingOngoing = (meeting: ChatMeeting, now?: number): boolean =>
  getMeetingStatus(meeting, now) === "ongoing";

export const getMeetingProgress = (
  meeting: ChatMeeting,
  now: number = Date.now(),
): MeetingProgress => {
  const elapsedMs = Math.max(0, now - startOf(meeting));
  const plannedMs = plannedMsOf(meeting);
  return {
    elapsedMs,
    plannedMs,
    isOverdue:
      plannedMs !== undefined &&
      elapsedMs > plannedMs &&
      getMeetingStatus(meeting, now) === "ongoing",
  };
};

/** `45 min`, `1 h`, `1 h 05`: the shape used in the meeting window. */
export const formatMeetingDuration = (ms: number): string => {
  const totalMinutes = Math.floor(ms / MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  return minutes === 0
    ? `${hours} h`
    : `${hours} h ${String(minutes).padStart(2, "0")}`;
};
