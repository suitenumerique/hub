// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatMeeting, ChatRef } from "@/features/drivers/types";

import { MeetingHistory } from "../MeetingHistory";

const archive = vi.hoisted(() => ({
  downloadArchive: vi.fn(async () => undefined),
  pendingMeetingId: null as string | null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}|${options.name}` : key,
    i18n: { language: "fr", resolvedLanguage: "fr" },
  }),
}));
vi.mock("@/features/chat/hooks/useMeetingArchive", () => ({
  useMeetingArchive: () => archive,
}));

const CHAT_REF: ChatRef = { accountId: "matrix", chatId: "!room:localhost" };

const meeting = (id: string, title: string): ChatMeeting => ({
  id,
  url: `https://meet.example.com/${id}`,
  organizerId: "@orga:localhost",
  title,
  startedAt: "2026-09-17T08:00:00.000Z",
  endedAt: "2026-09-17T09:00:00.000Z",
  documents: [],
});

const MEETINGS = [
  meeting("new-meet-ing", "Rétro"),
  meeting("old-meet-ing", "Point"),
];

const renderHistory = () =>
  render(
    <MeetingHistory
      chatRef={CHAT_REF}
      meetings={MEETINGS}
      isInitialLoading={false}
      isOpen
      onClose={vi.fn()}
      onBack={vi.fn()}
    />,
  );

describe("MeetingHistory archives", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    archive.pendingMeetingId = null;
  });

  it("downloads the archive of one meeting from its row", () => {
    renderHistory();

    const buttons = screen.getAllByLabelText(/^Download the archive of/);
    fireEvent.click(buttons[1]);

    expect(archive.downloadArchive).toHaveBeenCalledWith(MEETINGS[1]);
  });

  it("downloads the selected meeting from the header", () => {
    renderHistory();

    fireEvent.click(screen.getByRole("button", { pressed: false }));
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(archive.downloadArchive).toHaveBeenCalledWith(MEETINGS[1]);
  });

  it("waits for the archive being prepared", () => {
    archive.pendingMeetingId = "new-meet-ing";
    renderHistory();

    expect(
      screen.getByRole("button", { name: "Download" }).hasAttribute("disabled"),
    ).toBe(true);
    for (const button of screen.getAllByLabelText(/^Download the archive of/)) {
      expect(button.hasAttribute("disabled")).toBe(true);
    }
  });
});
