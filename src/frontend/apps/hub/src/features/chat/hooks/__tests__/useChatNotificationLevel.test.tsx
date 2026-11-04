// @vitest-environment jsdom
import "@/i18n/initI18n";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Chat, ChatRef, ChatSections } from "@/features/drivers/types";

import { chatKeys } from "../../chatKeys";
import { useChatNotificationLevel } from "../useChatNotificationLevel";

const { setChatNotificationLevel, notifyError } = vi.hoisted(() => ({
  setChatNotificationLevel:
    vi.fn<(chatId: string, level: string) => Promise<void>>(),
  notifyError: vi.fn(),
}));

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => ({ get: () => ({ setChatNotificationLevel }) }),
}));
vi.mock("@/features/ui/components/toast", () => ({
  notify: { error: notifyError },
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };
const CHAT: Chat = {
  id: CHAT_REF.chatId,
  accountId: CHAT_REF.accountId,
  ref: CHAT_REF,
  name: "Alice",
  section: "all",
  kind: "direct",
  participantIds: ["alice"],
  visual: { kind: "initials" },
  notificationLevel: "default",
  effectiveNotificationLevel: "all_messages",
};

describe("useChatNotificationLevel", () => {
  let queryClient: QueryClient;

  const levelsInCaches = () => ({
    chat: queryClient.getQueryData<Chat>(chatKeys.chat(CHAT_REF))
      ?.notificationLevel,
    list: queryClient.getQueryData<ChatSections>(
      chatKeys.chatsOf(CHAT_REF.accountId),
    )?.all[0].notificationLevel,
  });

  const mount = () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return renderHook(() => useChatNotificationLevel(CHAT_REF), { wrapper });
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    setChatNotificationLevel.mockReset();
    notifyError.mockReset();
    queryClient.setQueryData(chatKeys.chatsOf(CHAT_REF.accountId), {
      favourites: [],
      all: [CHAT],
    });
    queryClient.setQueryData(chatKeys.chat(CHAT_REF), CHAT);
  });

  afterEach(() => queryClient.clear());

  it("shows the level at once, before the driver answers", async () => {
    let finish = () => {};
    setChatNotificationLevel.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = mount();

    act(() => result.current.setLevel("mute"));

    await waitFor(() =>
      expect(levelsInCaches()).toEqual({ chat: "mute", list: "mute" }),
    );
    expect(setChatNotificationLevel).toHaveBeenCalledWith("chat-1", "mute");
    finish();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("takes the level back and says so when the write fails", async () => {
    setChatNotificationLevel.mockRejectedValue(new Error("refused"));
    const { result } = mount();

    act(() => result.current.setLevel("mute"));

    await waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1));
    expect(levelsInCaches()).toEqual({ chat: "default", list: "default" });
  });
});
