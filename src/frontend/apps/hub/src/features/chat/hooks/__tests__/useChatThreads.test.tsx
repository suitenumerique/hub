// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "../../chatKeys";
import type { ChatRef, ChatThread } from "@/features/drivers/types";

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
const hasMoreChatThreads = vi.fn<(chatId: string) => Promise<boolean>>();
const loadMoreChatThreads = vi.fn<(chatId: string) => Promise<void>>();

const registry = {
  get: vi.fn(() => ({
    getChatThreads,
    hasMoreChatThreads,
    loadMoreChatThreads,
  })),
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

describe("useChatThreads", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getChatThreads.mockReset();
    hasMoreChatThreads.mockReset().mockResolvedValue(false);
    loadMoreChatThreads.mockReset().mockResolvedValue();
    registry.get.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("reports loading then exposes the threads and the unread subset", async () => {
    getChatThreads.mockResolvedValueOnce([
      buildThread({ id: "t-1", unreadCount: 0 }),
      buildThread({ id: "t-2", unreadCount: 3 }),
    ]);

    const { result } = renderHook(() => useChatThreads(CHAT_REF), {
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

  it("keys the query by ChatRef", async () => {
    getChatThreads.mockResolvedValue([]);

    renderHook(
      () =>
        useChatThreads({
          accountId: "account-b",
          chatId: "chat-42",
        }),
      {
        wrapper: wrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(getChatThreads).toHaveBeenCalledWith("chat-42");
    });
    expect(registry.get).toHaveBeenCalledWith("account-b");
    expect(
      queryClient.getQueryData(
        chatKeys.threads({ accountId: "account-b", chatId: "chat-42" }),
      ),
    ).toBeDefined();
  });

  it("surfaces query errors without throwing", async () => {
    getChatThreads.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useChatThreads(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.threads).toEqual([]);
    expect(result.current.unreadThreads).toEqual([]);
  });

  it("loads older threads and lists them under the first page", async () => {
    getChatThreads
      .mockResolvedValueOnce([buildThread({ id: "t-1" })])
      .mockResolvedValue([
        buildThread({ id: "t-1" }),
        buildThread({ id: "t-2" }),
      ]);
    hasMoreChatThreads.mockResolvedValueOnce(true).mockResolvedValue(false);
    let finishLoading!: () => void;
    loadMoreChatThreads.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLoading = resolve;
        }),
    );

    const { result } = renderHook(() => useChatThreads(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.fetchMore());
    await waitFor(() => expect(result.current.isFetchingMore).toBe(true));
    // The end reached again while loading asks once the load ends, only if
    // older threads remain: none do here.
    act(() => result.current.fetchMore());
    finishLoading();

    await waitFor(() => expect(result.current.isFetchingMore).toBe(false));
    expect(loadMoreChatThreads).toHaveBeenCalledOnce();
    expect(loadMoreChatThreads).toHaveBeenCalledWith("chat-1");
    expect(result.current.threads.map((thread) => thread.id)).toEqual([
      "t-1",
      "t-2",
    ]);
    expect(result.current.hasMore).toBe(false);
  });

  it("asks again once a load ends when the end was reached meanwhile", async () => {
    getChatThreads.mockResolvedValue([buildThread()]);
    hasMoreChatThreads.mockResolvedValue(true);
    let finishLoading!: () => void;
    loadMoreChatThreads.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLoading = resolve;
        }),
    );

    const { result } = renderHook(() => useChatThreads(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.fetchMore());
    await waitFor(() => expect(result.current.isFetchingMore).toBe(true));
    act(() => result.current.fetchMore());
    expect(loadMoreChatThreads).toHaveBeenCalledOnce();
    finishLoading();

    await waitFor(() => expect(loadMoreChatThreads).toHaveBeenCalledTimes(2));
  });

  it("shows a failed load and retries it", async () => {
    getChatThreads.mockResolvedValue([buildThread()]);
    hasMoreChatThreads.mockResolvedValue(true);
    loadMoreChatThreads.mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useChatThreads(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => result.current.fetchMore());
    await waitFor(() => expect(result.current.isFetchMoreError).toBe(true));
    expect(result.current.isFetchingMore).toBe(false);

    act(() => result.current.fetchMore());
    await waitFor(() => expect(result.current.isFetchMoreError).toBe(false));

    expect(loadMoreChatThreads).toHaveBeenCalledTimes(2);
  });

  it("asks for older threads before knowing whether any remain", async () => {
    getChatThreads.mockResolvedValue([buildThread()]);
    hasMoreChatThreads.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useChatThreads(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => result.current.fetchMore());

    await waitFor(() => expect(loadMoreChatThreads).toHaveBeenCalledOnce());
  });

  it("asks nothing once no older thread remains", async () => {
    getChatThreads.mockResolvedValue([buildThread()]);

    const { result } = renderHook(() => useChatThreads(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() =>
      expect(hasMoreChatThreads).toHaveBeenCalledWith("chat-1"),
    );
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    await waitFor(() =>
      expect(queryClient.getQueryData(chatKeys.threadsHasMore(CHAT_REF))).toBe(
        false,
      ),
    );

    act(() => result.current.fetchMore());

    expect(loadMoreChatThreads).not.toHaveBeenCalled();
  });
});
