import { describe, expect, it } from "vitest";

import {
  formatMeetingDuration,
  getMeetingProgress,
  getMeetingStatus,
  MEETING_MAX_OVERTIME_MS,
  UNPLANNED_MEETING_WINDOW_MS,
} from "../meetingTime";
import type { ChatMeeting } from "../types";

const MINUTE = 60_000;
const NOW = Date.UTC(2026, 8, 16, 10, 0);

const meeting = (overrides: Partial<ChatMeeting> = {}): ChatMeeting => ({
  id: "abc-defg-hij",
  url: "https://meet.example.com/abc-defg-hij",
  organizerId: "@me:localhost",
  startedAt: new Date(NOW - 10 * MINUTE).toISOString(),
  documents: [],
  ...overrides,
});

describe("getMeetingStatus", () => {
  it("is upcoming before its start", () => {
    const scheduled = meeting({
      startedAt: new Date(NOW + 30 * MINUTE).toISOString(),
    });
    expect(getMeetingStatus(scheduled, NOW)).toBe("upcoming");
  });

  it("stays ongoing past its planned duration until the overtime limit", () => {
    const planned = meeting({ plannedDurationMinutes: 5 });
    expect(getMeetingStatus(planned, NOW)).toBe("ongoing");
    expect(
      getMeetingStatus(
        planned,
        NOW - 10 * MINUTE + 5 * MINUTE + MEETING_MAX_OVERTIME_MS,
      ),
    ).toBe("ended");
  });

  it("ends an unplanned meeting after the default window", () => {
    const unplanned = meeting();
    expect(getMeetingStatus(unplanned, NOW)).toBe("ongoing");
    expect(
      getMeetingStatus(
        unplanned,
        NOW - 10 * MINUTE + UNPLANNED_MEETING_WINDOW_MS,
      ),
    ).toBe("ended");
  });

  it("is ended once closed, even before its planned end", () => {
    const closed = meeting({
      plannedDurationMinutes: 60,
      endedAt: new Date(NOW - MINUTE).toISOString(),
    });
    expect(getMeetingStatus(closed, NOW)).toBe("ended");
  });
});

describe("getMeetingProgress", () => {
  it("reports the elapsed and planned time", () => {
    expect(
      getMeetingProgress(meeting({ plannedDurationMinutes: 30 }), NOW),
    ).toEqual({
      elapsedMs: 10 * MINUTE,
      plannedMs: 30 * MINUTE,
      isOverdue: false,
    });
  });

  it("flags an ongoing meeting past its planned duration", () => {
    expect(
      getMeetingProgress(meeting({ plannedDurationMinutes: 5 }), NOW).isOverdue,
    ).toBe(true);
  });

  it("counts nothing before the start of a scheduled meeting", () => {
    const scheduled = meeting({
      startedAt: new Date(NOW + MINUTE).toISOString(),
      plannedDurationMinutes: 30,
    });
    expect(getMeetingProgress(scheduled, NOW)).toMatchObject({
      elapsedMs: 0,
      isOverdue: false,
    });
  });
});

describe("formatMeetingDuration", () => {
  it.each([
    [45 * MINUTE, "45 min"],
    [60 * MINUTE, "1 h"],
    [65 * MINUTE, "1 h 05"],
    [150 * MINUTE, "2 h 30"],
  ])("formats %d ms as %s", (ms, expected) => {
    expect(formatMeetingDuration(ms)).toBe(expected);
  });
});
