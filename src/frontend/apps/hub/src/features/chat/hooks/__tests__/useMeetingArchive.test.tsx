// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APIError } from "@/features/api/APIError";
import type { ChatMeeting, ChatRef } from "@/features/drivers/types";

import { useMeetingArchive } from "../useMeetingArchive";

const mocks = vi.hoisted(() => ({
  getOpenIdToken: vi.fn<() => Promise<string>>(),
  fetchMeetingArchive: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// The real error class loads the i18n setup, which the mock above replaces.
vi.mock("@/features/api/APIError", () => ({
  APIError: class APIError extends Error {
    constructor(public code: number) {
      super(`API error ${code}`);
    }
  },
}));
vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => ({
    get: () => ({ getOpenIdToken: mocks.getOpenIdToken }),
  }),
}));
vi.mock("@/features/chat/api/meetings", () => ({
  fetchMeetingArchive: mocks.fetchMeetingArchive,
}));
vi.mock("@/features/ui/components/toast", () => ({
  notify: { error: mocks.notifyError },
}));

const CHAT_REF: ChatRef = { accountId: "matrix", chatId: "!room:localhost" };
const SUMMARY = { id: "s", title: "Transcription", url: "https://docs/s/" };
const LINK = { id: "l", title: "Support", url: "https://docs/l/" };
const MEETING: ChatMeeting = {
  id: "abc-defg-hij",
  url: "https://meet.example.com/abc-defg-hij",
  organizerId: "@orga:localhost",
  startedAt: "2026-09-17T08:00:00.000Z",
  endedAt: "2026-09-17T09:00:00.000Z",
  documents: [LINK],
  summary: SUMMARY,
};

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useMeetingArchive(CHAT_REF), { wrapper });
};

describe("useMeetingArchive", () => {
  let click: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.getOpenIdToken.mockResolvedValue("openid");
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:archive"),
      revokeObjectURL: vi.fn(),
    });
    click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.href).toBe("blob:archive");
        expect(this.download).toBe("reunion.zip");
      });
  });

  afterEach(() => {
    vi.clearAllMocks();
    click.mockRestore();
  });

  it("downloads the archive with the account's proof and the documents", async () => {
    mocks.fetchMeetingArchive.mockResolvedValue({
      blob: new Blob(["zip"]),
      fileName: "reunion.zip",
    });
    const { result } = setup();

    await act(() => result.current.downloadArchive(MEETING));

    expect(mocks.fetchMeetingArchive).toHaveBeenCalledWith("abc-defg-hij", {
      openIdToken: "openid",
      documents: [SUMMARY, LINK],
    });
    expect(click).toHaveBeenCalledOnce();
    expect(mocks.notifyError).not.toHaveBeenCalled();
  });

  it.each([
    [new APIError(404), "No archive is available for this meeting."],
    [new APIError(409), "The archive is available once the meeting is closed."],
    [
      new Error("down"),
      "The archive could not be downloaded. Please try again.",
    ],
  ])("explains a failure (%s)", async (error, message) => {
    mocks.fetchMeetingArchive.mockRejectedValue(error);
    const { result } = setup();

    await act(() => result.current.downloadArchive(MEETING));

    expect(mocks.notifyError).toHaveBeenCalledWith(message);
    expect(click).not.toHaveBeenCalled();
  });
});
