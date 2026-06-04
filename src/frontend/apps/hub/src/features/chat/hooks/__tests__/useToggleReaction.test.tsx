// @vitest-environment jsdom
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "../../chatKeys";
import type {
  ChatRef,
  ChatMessage,
  ChatMessagesPage,
  ChatThreadDetail,
} from "@/features/drivers/types";

import { useToggleReaction } from "../useToggleReaction";

const toggleChatReaction = vi.fn();
const toggleChatThreadReaction = vi.fn();

const registry = {
  get: vi.fn(() => ({ toggleChatReaction, toggleChatThreadReaction })),
};

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => registry,
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };
const CHAT_ID = "chat-1";
const QUERY_KEY = chatKeys.messages(CHAT_REF);

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

const makeData = (pages: ChatMessage[][]): InfiniteData<ChatMessagesPage> => ({
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
    toggleChatThreadReaction.mockReset();
    registry.get.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderToggle = () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    Wrapper.displayName = "TestQueryClientProvider";
    return renderHook(() => useToggleReaction(CHAT_REF), { wrapper: Wrapper });
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

describe("useToggleReaction (thread mode)", () => {
  let queryClient: QueryClient;

  const THREAD_ID = "t-1";
  const THREAD_KEY = chatKeys.thread(CHAT_REF, THREAD_ID);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    toggleChatReaction.mockReset();
    toggleChatThreadReaction.mockReset();
    registry.get.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const makeDetail = (messages: ChatMessage[]): ChatThreadDetail => ({
    id: THREAD_ID,
    rootMessageId: messages[0].id,
    messages,
    authors: [],
    firstUnreadIndex: null,
  });

  const renderThreadToggle = () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    Wrapper.displayName = "TestQueryClientProvider";
    return renderHook(() => useToggleReaction(CHAT_REF, THREAD_ID), {
      wrapper: Wrapper,
    });
  };

  const threadReactionsFor = (messageId: string) =>
    queryClient
      .getQueryData<ChatThreadDetail>(THREAD_KEY)
      ?.messages.find((message) => message.id === messageId)?.reactions;

  it("optimistically toggles a reaction in the thread detail cache", async () => {
    toggleChatThreadReaction.mockResolvedValue(makeMessage("t-1-r1"));
    queryClient.setQueryData(
      THREAD_KEY,
      makeDetail([makeMessage("m-1"), makeMessage("t-1-r1")]),
    );

    const { result } = renderThreadToggle();
    act(() => {
      result.current.toggle("t-1-r1", "🎉");
    });

    await waitFor(() => {
      expect(threadReactionsFor("t-1-r1")).toEqual([
        { emoji: "🎉", count: 1, reactedByMe: true },
      ]);
    });
    // The root message is left untouched.
    expect(threadReactionsFor("m-1")).toEqual([]);
    expect(toggleChatThreadReaction).toHaveBeenCalledWith({
      chatId: CHAT_ID,
      threadId: THREAD_ID,
      messageId: "t-1-r1",
      emoji: "🎉",
    });
    expect(toggleChatReaction).not.toHaveBeenCalled();
  });

  it("rolls the thread cache back when the driver call fails", async () => {
    let rejectToggle: (error: Error) => void = () => {};
    toggleChatThreadReaction.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectToggle = reject;
      }),
    );
    queryClient.setQueryData(THREAD_KEY, makeDetail([makeMessage("t-1-r1")]));

    const { result } = renderThreadToggle();
    act(() => {
      result.current.toggle("t-1-r1", "👍");
    });

    await waitFor(() => {
      expect(threadReactionsFor("t-1-r1")).toEqual([
        { emoji: "👍", count: 1, reactedByMe: true },
      ]);
    });

    act(() => {
      rejectToggle(new Error("network down"));
    });

    await waitFor(() => {
      expect(threadReactionsFor("t-1-r1")).toEqual([]);
    });
  });
});
