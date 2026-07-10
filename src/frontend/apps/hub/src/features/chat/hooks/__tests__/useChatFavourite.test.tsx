// @vitest-environment jsdom
import "@/i18n/initI18n";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "../../chatKeys";
import type { Chat, ChatRef, ChatSections } from "@/features/drivers/types";

import { useChatFavourite } from "../useChatFavourite";

const { setChatFavourite, notifyError } = vi.hoisted(() => ({
  setChatFavourite:
    vi.fn<(chatId: string, favourite: boolean) => Promise<void>>(),
  notifyError: vi.fn(),
}));

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => ({ get: () => ({ setChatFavourite }) }),
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
};

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

const seed = (queryClient: QueryClient) => {
  const sections: ChatSections = { favourites: [], all: [CHAT] };
  queryClient.setQueryData(chatKeys.chatsOf(CHAT_REF.accountId), sections);
  queryClient.setQueryData(chatKeys.chat(CHAT_REF), CHAT);
};

describe("useChatFavourite", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    setChatFavourite.mockReset();
    notifyError.mockReset();
    seed(queryClient);
  });

  afterEach(() => queryClient.clear());

  it("moves a chat optimistically without leaving it in all chats", async () => {
    let resolveMutation: (() => void) | undefined;
    setChatFavourite.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveMutation = resolve;
        }),
    );
    const { result } = renderHook(() => useChatFavourite(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });

    act(() => result.current.setFavourite(true));

    await waitFor(() => {
      const sections = queryClient.getQueryData<ChatSections>(
        chatKeys.chatsOf(CHAT_REF.accountId),
      );
      expect(sections?.favourites.map((chat) => chat.id)).toEqual(["chat-1"]);
      expect(sections?.all).toEqual([]);
    });
    expect(
      queryClient.getQueryData<Chat>(chatKeys.chat(CHAT_REF))?.section,
    ).toBe("favourites");

    act(() => resolveMutation?.());
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it("rolls both caches back when the driver rejects", async () => {
    setChatFavourite.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useChatFavourite(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });

    act(() => result.current.setFavourite(true));

    await waitFor(() => expect(notifyError).toHaveBeenCalledOnce());
    expect(
      queryClient.getQueryData<Chat>(chatKeys.chat(CHAT_REF))?.section,
    ).toBe("all");
    expect(
      queryClient.getQueryData<ChatSections>(
        chatKeys.chatsOf(CHAT_REF.accountId),
      )?.all,
    ).toHaveLength(1);
  });
});
