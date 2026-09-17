// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMeetingDocument, ChatRef } from "@/features/drivers/types";

import { chatKeys } from "../../chatKeys";
import { useChatMeetingActions } from "../useChatMeetingActions";

const mocks = vi.hoisted(() => ({
  endChatMeeting: vi.fn<(chatId: string, meetingId: string) => Promise<void>>(),
  extendChatMeeting:
    vi.fn<
      (chatId: string, meetingId: string, minutes: number) => Promise<void>
    >(),
  renameChatMeeting:
    vi.fn<
      (chatId: string, meetingId: string, title: string) => Promise<void>
    >(),
  updateMeeting:
    vi.fn<
      (
        slug: string,
        change: { title?: string; extendMinutes?: number },
      ) => Promise<void>
    >(),
  addChatMeetingDocument:
    vi.fn<
      (
        chatId: string,
        meetingId: string,
        document: ChatMeetingDocument,
      ) => Promise<void>
    >(),
  saveMeetingTranscript:
    vi.fn<
      (slug: string, title: string) => Promise<ChatMeetingDocument | null>
    >(),
  notify: { brand: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => ({
    get: () => ({
      endChatMeeting: mocks.endChatMeeting,
      extendChatMeeting: mocks.extendChatMeeting,
      renameChatMeeting: mocks.renameChatMeeting,
      addChatMeetingDocument: mocks.addChatMeetingDocument,
    }),
  }),
}));
vi.mock("@/features/chat/api/meetingTranscripts", () => ({
  saveMeetingTranscript: mocks.saveMeetingTranscript,
}));
vi.mock("@/features/chat/api/meetings", () => ({
  updateMeeting: mocks.updateMeeting,
}));
vi.mock("@/features/ui/components/toast", () => ({ notify: mocks.notify }));

const CHAT_REF: ChatRef = { accountId: "matrix", chatId: "!room:localhost" };
const TRANSCRIPT: ChatMeetingDocument = {
  id: "doc-123",
  title: "Transcription : Point hebdo",
  url: "https://docs.example.com/docs/doc-123/",
};

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useChatMeetingActions(CHAT_REF), {
    wrapper,
  });
  return { result, invalidate };
};

describe("useChatMeetingActions.endMeeting", () => {
  beforeEach(() => {
    mocks.endChatMeeting.mockResolvedValue(undefined);
    mocks.addChatMeetingDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("closes the meeting, then adds its transcript to the documents", async () => {
    mocks.saveMeetingTranscript.mockResolvedValue(TRANSCRIPT);
    const { result, invalidate } = setup();

    await result.current.endMeeting("abc-defg-hij", "Point hebdo");

    expect(mocks.endChatMeeting).toHaveBeenCalledWith(
      CHAT_REF.chatId,
      "abc-defg-hij",
    );
    expect(mocks.saveMeetingTranscript).toHaveBeenCalledWith(
      "abc-defg-hij",
      "Point hebdo",
    );
    expect(mocks.addChatMeetingDocument).toHaveBeenCalledWith(
      CHAT_REF.chatId,
      "abc-defg-hij",
      TRANSCRIPT,
    );
    expect(mocks.endChatMeeting.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.saveMeetingTranscript.mock.invocationCallOrder[0],
    );
    expect(mocks.notify.brand).toHaveBeenCalledWith(
      "The transcript was saved in Docs.",
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: chatKeys.meetings(CHAT_REF),
    });
  });

  it("adds nothing when there is no transcript", async () => {
    mocks.saveMeetingTranscript.mockResolvedValue(null);
    const { result } = setup();

    await result.current.endMeeting("abc-defg-hij", "Point hebdo");

    expect(mocks.addChatMeetingDocument).not.toHaveBeenCalled();
    expect(mocks.notify.brand).not.toHaveBeenCalled();
    expect(mocks.notify.warning).not.toHaveBeenCalled();
  });

  it("only warns when the transcript cannot be saved", async () => {
    mocks.saveMeetingTranscript.mockRejectedValue(new Error("Docs is down"));
    const { result } = setup();

    await expect(
      result.current.endMeeting("abc-defg-hij", "Point hebdo"),
    ).resolves.toBeUndefined();

    expect(mocks.notify.warning).toHaveBeenCalledWith(
      "The meeting is closed, but its transcript could not be saved.",
    );
    expect(mocks.notify.error).not.toHaveBeenCalled();
  });

  it("saves no transcript when the meeting could not be closed", async () => {
    mocks.endChatMeeting.mockRejectedValue(new Error("403"));
    const { result } = setup();

    await expect(
      result.current.endMeeting("abc-defg-hij", "Point hebdo"),
    ).rejects.toThrow("403");

    expect(mocks.saveMeetingTranscript).not.toHaveBeenCalled();
    expect(mocks.notify.error).toHaveBeenCalledWith(
      "The meeting could not be updated. Please try again.",
    );
  });
});

describe("useChatMeetingActions keeps the server in step", () => {
  beforeEach(() => {
    mocks.extendChatMeeting.mockResolvedValue(undefined);
    mocks.renameChatMeeting.mockResolvedValue(undefined);
    mocks.updateMeeting.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("pushes the planned end back on the server too", async () => {
    const { result } = setup();

    await result.current.extendMeeting("abc-defg-hij", 15);

    expect(mocks.extendChatMeeting).toHaveBeenCalledWith(
      CHAT_REF.chatId,
      "abc-defg-hij",
      15,
    );
    expect(mocks.updateMeeting).toHaveBeenCalledWith("abc-defg-hij", {
      extendMinutes: 15,
    });
  });

  it("renames the meeting on the server too", async () => {
    const { result } = setup();

    await result.current.renameMeeting("abc-defg-hij", " Rétro ");

    expect(mocks.updateMeeting).toHaveBeenCalledWith("abc-defg-hij", {
      title: "Rétro",
    });
  });

  it("ignores a server that does not know the meeting", async () => {
    mocks.updateMeeting.mockRejectedValue(new Error("404"));
    const { result } = setup();

    await expect(
      result.current.extendMeeting("abc-defg-hij", 15),
    ).resolves.toBeUndefined();

    expect(mocks.notify.error).not.toHaveBeenCalled();
  });
});
