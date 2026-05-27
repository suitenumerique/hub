// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatThread } from "@/features/drivers/types";

import { useChatThreads } from "../useChatThreads";

const buildThread = (over: Partial<ChatThread> = {}): ChatThread => ({
  id: "t-1",
  rootMessageId: "m-1",
  author: { id: "a-1", name: "Ada Lovelace", initials: "AL", color: "blue-1" },
  lastReplyAt: "2026-05-12T10:00:00.000Z",
  lastReplyPreview: "Latest reply",
  replyCount: 5,
  unreadCount: 0,
  ...over,
});

const getChatThreads = vi.fn<(chatId: string) => Promise<ChatThread[]>>();

vi.mock("@/features/config/Config", () => ({
  getDriver: () => ({ getChatThreads }),
}));

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

describe("useChatThreads", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getChatThreads.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("reports loading then exposes the threads and the unread subset", async () => {
    getChatThreads.mockResolvedValueOnce([
      buildThread({ id: "t-1", unreadCount: 0 }),
      buildThread({ id: "t-2", unreadCount: 3 }),
    ]);

    const { result } = renderHook(() => useChatThreads("chat-1"), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.threads).toEqual([]);

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(result.current.threads).toHaveLength(2);
    expect(result.current.unreadThreads).toHaveLength(1);
    expect(result.current.unreadThreads[0].id).toBe("t-2");
    expect(result.current.isError).toBe(false);
  });

  it("keys the query by chatId", async () => {
    getChatThreads.mockResolvedValue([]);

    renderHook(() => useChatThreads("chat-42"), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(getChatThreads).toHaveBeenCalledWith("chat-42");
    });
  });

  it("surfaces query errors without throwing", async () => {
    getChatThreads.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useChatThreads("chat-1"), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.threads).toEqual([]);
    expect(result.current.unreadThreads).toEqual([]);
  });
});
