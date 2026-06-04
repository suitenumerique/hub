// @vitest-environment jsdom
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "../../chatKeys";
import type { ChatEvent, ChatEventListener } from "@/features/drivers/Driver";
import type {
  ChatRef,
  ChatMessage,
  ChatMessageAuthor,
  ChatMessagesPage,
} from "@/features/drivers/types";

import { useChatEvents } from "../useChatEvents";

let capturedListener: ChatEventListener | null = null;
const unsubscribe = vi.fn();
const subscribeToEvents = vi.fn((listener: ChatEventListener) => {
  capturedListener = listener;
  return unsubscribe;
});

vi.mock("@/features/drivers/DriverRegistry", () => ({
  useDriverEntries: () => [
    {
      accountId: "account-a",
      kind: "mock",
      label: "Account A",
      criticality: "required",
      enabled: true,
      driver: { subscribeToEvents },
    },
  ],
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "c1" };

const author = (id: string): ChatMessageAuthor => ({
  id,
  name: id,
  initials: id.slice(0, 2).toUpperCase(),
  color: "blue-1",
});

const message = (id: string): ChatMessage => ({
  id,
  authorId: "a-1",
  content: id,
  timestamp: "2026-05-12T10:00:00.000Z",
  reactions: [],
});

const seedMessages = (
  queryClient: QueryClient,
  ref: ChatRef,
  messages: ChatMessage[],
  authors: ChatMessageAuthor[],
) => {
  const data: InfiniteData<ChatMessagesPage> = {
    pages: [{ messages, authors, nextCursor: null }],
    pageParams: [null],
  };
  queryClient.setQueryData(chatKeys.messages(ref), data);
};

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

const emit = (event: ChatEvent) => act(() => capturedListener?.(event));

describe("useChatEvents", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    capturedListener = null;
    subscribeToEvents.mockClear();
    unsubscribe.mockClear();
  });

  afterEach(() => queryClient.clear());

  const mount = () =>
    renderHook(() => useChatEvents(), { wrapper: wrapper(queryClient) });

  it("subscribes once to the global stream and unsubscribes on unmount", () => {
    const { unmount } = mount();
    expect(subscribeToEvents).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("PATCHES the cache on message:new (append + merge authors, no refetch)", () => {
    seedMessages(queryClient, CHAT_REF, [message("m1")], [author("a-1")]);
    mount();

    emit({
      type: "message:new",
      chatId: "c1",
      message: message("m2"),
      authors: [author("a-2")],
    });

    const data = queryClient.getQueryData<InfiniteData<ChatMessagesPage>>([
      "chat-messages",
      "account-a",
      "c1",
    ]);
    expect(data?.pages[0].messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(data?.pages[0].authors.map((a) => a.id)).toContain("a-2");
  });

  it("is idempotent on a duplicate message:new", () => {
    seedMessages(queryClient, CHAT_REF, [message("m1")], [author("a-1")]);
    mount();

    emit({ type: "message:new", chatId: "c1", message: message("m1") });

    const data = queryClient.getQueryData<InfiniteData<ChatMessagesPage>>([
      "chat-messages",
      "account-a",
      "c1",
    ]);
    expect(data?.pages[0].messages).toHaveLength(1);
  });

  it("PATCHES reactions on reaction:updated", () => {
    seedMessages(queryClient, CHAT_REF, [message("m1")], [author("a-1")]);
    mount();

    emit({
      type: "reaction:updated",
      chatId: "c1",
      messageId: "m1",
      reactions: [{ emoji: "👍", count: 1, reactedByMe: true }],
    });

    const data = queryClient.getQueryData<InfiniteData<ChatMessagesPage>>([
      "chat-messages",
      "account-a",
      "c1",
    ]);
    expect(data?.pages[0].messages[0].reactions[0].emoji).toBe("👍");
  });

  it.each<[ChatEvent, readonly unknown[]]>([
    [
      { type: "chat:changed", chatId: "c1" },
      ["chat-messages", "account-a", "c1"],
    ],
    [
      { type: "threads:changed", chatId: "c1" },
      ["chat-threads", "account-a", "c1"],
    ],
    [
      { type: "documents:changed", chatId: "c1" },
      ["chat-documents", "account-a", "c1"],
    ],
    [{ type: "chats:changed" }, ["chats", "account-a"]],
  ])("INVALIDATES the right cache on %o", (event, queryKey) => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mount();

    emit(event);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
  });
});
