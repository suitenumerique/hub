// @vitest-environment jsdom
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage, ChatMessagesPage } from "@/features/drivers/types";

import { useToggleReaction } from "../useToggleReaction";

const toggleChatReaction = vi.fn();

vi.mock("@/features/config/Config", () => ({
  getDriver: () => ({ toggleChatReaction }),
}));

const CHAT_ID = "chat-1";
const QUERY_KEY = ["chat-messages", CHAT_ID];

const makeMessage = (
  id: string,
  reactions: ChatMessage["reactions"] = [],
): ChatMessage => ({
  id,
  authorId: "alice",
  content: `msg ${id}`,
  timestamp: "2026-01-01T08:00:00Z",
  reactions,
});

const makeData = (
  pages: ChatMessage[][],
): InfiniteData<ChatMessagesPage> => ({
  pages: pages.map((messages) => ({ messages, authors: [], nextCursor: null })),
  pageParams: pages.map(() => null),
});

describe("useToggleReaction", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    toggleChatReaction.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderToggle = () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    Wrapper.displayName = "TestQueryClientProvider";
    return renderHook(() => useToggleReaction(CHAT_ID), { wrapper: Wrapper });
  };

  const reactionsAt = (pageIndex: number, messageIndex: number) =>
    queryClient.getQueryData<InfiniteData<ChatMessagesPage>>(QUERY_KEY)?.pages[
      pageIndex
    ].messages[messageIndex].reactions;

  it("optimistically adds a reaction in the page that holds the message", async () => {
    toggleChatReaction.mockResolvedValue(makeMessage("m-2"));
    queryClient.setQueryData(
      QUERY_KEY,
      makeData([[makeMessage("m-1")], [makeMessage("m-2")]]),
    );

    const { result } = renderToggle();
    act(() => {
      result.current.toggle("m-2", "👍");
    });

    await waitFor(() => {
      expect(reactionsAt(1, 0)).toEqual([
        { emoji: "👍", count: 1, reactedByMe: true },
      ]);
    });
    // The page that does not hold the message is left untouched.
    expect(reactionsAt(0, 0)).toEqual([]);
  });

  it("optimistically removes the current user's reaction", async () => {
    toggleChatReaction.mockResolvedValue(makeMessage("m-1"));
    queryClient.setQueryData(
      QUERY_KEY,
      makeData([
        [makeMessage("m-1", [{ emoji: "👍", count: 1, reactedByMe: true }])],
      ]),
    );

    const { result } = renderToggle();
    act(() => {
      result.current.toggle("m-1", "👍");
    });

    await waitFor(() => {
      expect(reactionsAt(0, 0)).toEqual([]);
    });
  });

  it("rolls the cache back to its snapshot when the driver call fails", async () => {
    let rejectToggle: (error: Error) => void = () => {};
    toggleChatReaction.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectToggle = reject;
      }),
    );
    queryClient.setQueryData(QUERY_KEY, makeData([[makeMessage("m-1")]]));

    const { result } = renderToggle();
    act(() => {
      result.current.toggle("m-1", "👍");
    });

    // The optimistic update lands before the driver call settles.
    await waitFor(() => {
      expect(reactionsAt(0, 0)).toEqual([
        { emoji: "👍", count: 1, reactedByMe: true },
      ]);
    });

    act(() => {
      rejectToggle(new Error("network down"));
    });

    // onError restores the pre-toggle snapshot.
    await waitFor(() => {
      expect(reactionsAt(0, 0)).toEqual([]);
    });
  });
});
