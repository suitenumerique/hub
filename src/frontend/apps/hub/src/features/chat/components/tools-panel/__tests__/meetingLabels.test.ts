import { describe, expect, it } from "vitest";

import type { ChatMeeting } from "@/features/drivers/types";

import { formatMeetingLabel } from "../meetingLabels";

const meeting = (overrides: Partial<ChatMeeting> = {}): ChatMeeting => ({
  id: "abc-defg-hij",
  url: "https://meet.example.com/abc-defg-hij",
  organizerId: "@me:localhost",
  // Local time, so the expectation does not depend on the time zone.
  startedAt: new Date(2026, 8, 16, 9, 5).toISOString(),
  documents: [],
  ...overrides,
});

describe("formatMeetingLabel", () => {
  it("labels a meeting by its day and its name", () => {
    expect(
      formatMeetingLabel(meeting({ title: "Point" }), "Réunion", "fr"),
    ).toBe("16/09 Point");
  });

  it("adds the start time on request, with the fallback name", () => {
    expect(
      formatMeetingLabel(meeting(), "Réunion", "fr", { withTime: true }),
    ).toBe("16/09 09:05 Réunion");
  });
});
