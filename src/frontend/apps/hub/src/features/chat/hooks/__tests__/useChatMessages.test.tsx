// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessagesPage } from "@/features/drivers/types";

import { useChatMessages } from "../useChatMessages";

const buildPage = (
  index: number,
  options: { hasOlder?: boolean } = {},
): ChatMessagesPage => {
  const start = index * 10;
  return {
    messages: Array.from({ length: 10 }, (_, i) => ({
      id: `m-${start + i}`,
      authorId: i % 2 === 0 ? "alice" : "me",
      content: `msg ${start + i}`,
      timestamp: new Date(2026, 0, 1, 8, start + i).toISOString(),
      reactions: [],
    })),
    authors: [{ id: "alice", name: "Alice", initials: "A", color: "blue-1" }],
    nextCursor: options.hasOlder ? `cursor-${index + 1}` : null,
  };
};

const getChatMessages =
  vi.fn<
    (params: {
      chatId: string;
      cursor?: string | null;
      limit?: number;
    }) => Promise<ChatMessagesPage>
  >();

vi.mock("@/features/config/Config", () => ({
  getDriver: () => ({ getChatMessages }),
}));

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

describe("useChatMessages", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getChatMessages.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("flattens pages oldest-first and reports loading then ready states", async () => {
    getChatMessages.mockResolvedValueOnce(buildPage(0, { hasOlder: true }));

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.messages).toEqual([]);

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(result.current.messages).toHaveLength(10);
    expect(result.current.messages[0].id).toBe("m-0");
    expect(result.current.hasOlder).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it("prepends older messages and shifts firstItemIndex by the prepend count", async () => {
    getChatMessages
      .mockResolvedValueOnce(buildPage(0, { hasOlder: true }))
      .mockResolvedValueOnce(buildPage(1, { hasOlder: false }));

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(10));
    const firstIndexBefore = result.current.firstItemIndex;
    const firstIdBefore = result.current.messages[0].id;

    act(() => {
      result.current.fetchOlder();
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(20));

    // Older page (index 1) is prepended, so the previously-first message is
    // now at position 10 in the flat array.
    expect(result.current.messages[10].id).toBe(firstIdBefore);
    // firstItemIndex shifts by exactly the number of newly prepended messages.
    expect(result.current.firstItemIndex).toBe(firstIndexBefore - 10);
    expect(result.current.hasOlder).toBe(false);
  });

  it("does not refetch while a fetchOlder is already in flight", async () => {
    let resolveSecond: ((page: ChatMessagesPage) => void) | undefined;
    getChatMessages
      .mockResolvedValueOnce(buildPage(0, { hasOlder: true }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(10));

    act(() => {
      result.current.fetchOlder();
    });
    await waitFor(() => expect(result.current.isFetchingOlder).toBe(true));

    act(() => {
      result.current.fetchOlder();
      result.current.fetchOlder();
    });

    expect(getChatMessages).toHaveBeenCalledTimes(2);
    resolveSecond?.(buildPage(1, { hasOlder: false }));
    await waitFor(() => expect(result.current.isFetchingOlder).toBe(false));
  });

  it("aggregates authors from every page into a Map", async () => {
    getChatMessages
      .mockResolvedValueOnce({
        messages: [
          {
            id: "m-1",
            authorId: "alice",
            content: "hi",
            timestamp: "2026-01-01T08:00:00Z",
            reactions: [],
          },
        ],
        authors: [
          { id: "alice", name: "Alice", initials: "A", color: "blue-1" },
        ],
        nextCursor: "c1",
      })
      .mockResolvedValueOnce({
        messages: [
          {
            id: "m-2",
            authorId: "bob",
            content: "hey",
            timestamp: "2026-01-01T07:00:00Z",
            reactions: [],
          },
        ],
        authors: [
          { id: "alice", name: "Alice", initials: "A", color: "blue-1" },
          { id: "bob", name: "Bob", initials: "B", color: "green" },
        ],
        nextCursor: null,
      });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => {
      result.current.fetchOlder();
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    expect(result.current.authorsById.get("alice")?.name).toBe("Alice");
    expect(result.current.authorsById.get("bob")?.name).toBe("Bob");
  });

  it("surfaces query errors without throwing", async () => {
    getChatMessages.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.messages).toEqual([]);
    expect(result.current.isInitialLoading).toBe(false);
  });
});
