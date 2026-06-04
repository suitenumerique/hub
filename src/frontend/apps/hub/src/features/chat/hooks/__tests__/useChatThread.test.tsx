// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GetChatThreadParams } from "@/features/drivers/Driver";
import type { ChatRef, ChatThreadDetail } from "@/features/drivers/types";

import { useChatThread } from "../useChatThread";

const buildDetail = (): ChatThreadDetail => ({
  id: "t-1",
  rootMessageId: "m-1",
  messages: [
    {
      id: "m-1",
      authorId: "a-1",
      content: "Root message",
      timestamp: "2026-05-12T09:00:00.000Z",
      reactions: [],
    },
    {
      id: "t-1-r1",
      authorId: "a-1",
      content: "A reply",
      timestamp: "2026-05-12T09:05:00.000Z",
      reactions: [],
    },
  ],
  authors: [
    { id: "a-1", name: "Ada Lovelace", initials: "AL", color: "blue-1" },
  ],
  firstUnreadIndex: 1,
});

const getChatThread =
  vi.fn<(params: GetChatThreadParams) => Promise<ChatThreadDetail>>();

const registry = {
  get: vi.fn(() => ({ getChatThread })),
};

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => registry,
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

describe("useChatThread", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getChatThread.mockReset();
    registry.get.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("loads a thread keyed by chatId and threadId", async () => {
    getChatThread.mockResolvedValueOnce(buildDetail());

    const { result } = renderHook(() => useChatThread(CHAT_REF, "t-1"), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.thread).toBeNull();

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(getChatThread).toHaveBeenCalledWith({
      chatId: "chat-1",
      threadId: "t-1",
    });
    expect(registry.get).toHaveBeenCalledWith("account-a");
    expect(result.current.thread?.messages).toHaveLength(2);
    expect(result.current.thread?.firstUnreadIndex).toBe(1);
  });

  it("surfaces query errors without throwing", async () => {
    getChatThread.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useChatThread(CHAT_REF, "t-1"), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.thread).toBeNull();
  });
});
