// @vitest-environment jsdom
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
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
  ChatThreadDetail,
} from "@/features/drivers/types";

import {
  beginReactionToggle,
  endReactionToggle,
} from "../../pendingReactionToggles";
import { replayRecentLiveMessages, useChatEvents } from "../useChatEvents";

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
      label: "Account A",
      criticality: "required",
      enabled: true,
      settingsFingerprint: "",
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

  it("patches decrypted messages without refetching lists for every event", () => {
    seedMessages(queryClient, CHAT_REF, [message("m1"), message("m2")], []);
    mount();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    for (const id of ["m1", "m2"]) {
      emit({
        type: "message:reconciled",
        chatId: "c1",
        messageId: id,
        message: { ...message(id), content: "decrypted" },
      });
    }

    const data = queryClient.getQueryData<InfiniteData<ChatMessagesPage>>(
      chatKeys.messages(CHAT_REF),
    );
    expect(data?.pages[0].messages.map((m) => m.content)).toEqual([
      "decrypted",
      "decrypted",
    ]);
    expect(invalidate).not.toHaveBeenCalled();

    emit({ type: "chats:changed" });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: chatKeys.chatsOf(CHAT_REF.accountId),
    });
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

  const messageIds = (ref: ChatRef = CHAT_REF) =>
    queryClient
      .getQueryData<InfiniteData<ChatMessagesPage>>(chatKeys.messages(ref))
      ?.pages.flatMap((page) => page.messages.map((m) => m.id));

  it("appends a live message whose timestamp is older than the page", () => {
    seedMessages(queryClient, CHAT_REF, [message("m1")], []);
    mount();

    // A lagging homeserver can deliver it with an older send time.
    emit({
      type: "message:new",
      chatId: "c1",
      message: { ...message("m2"), timestamp: "2026-05-12T09:00:00.000Z" },
    });

    expect(messageIds()).toEqual(["m1", "m2"]);
  });

  it("does not append a message already in an older page", () => {
    queryClient.setQueryData<InfiniteData<ChatMessagesPage>>(
      chatKeys.messages(CHAT_REF),
      {
        pages: [
          { messages: [message("m2")], authors: [], nextCursor: "m2" },
          { messages: [message("m1")], authors: [], nextCursor: null },
        ],
        pageParams: [null, "m2"],
      },
    );
    mount();

    emit({ type: "message:new", chatId: "c1", message: message("m1") });

    expect(messageIds()).toEqual(["m2", "m1"]);
  });

  it("keeps a message received while the first page loads", async () => {
    let resolvePage: (page: ChatMessagesPage) => void = () => {};
    const loading = queryClient.fetchInfiniteQuery({
      queryKey: chatKeys.messages(CHAT_REF),
      queryFn: () =>
        new Promise<ChatMessagesPage>((resolve) => {
          resolvePage = resolve;
        }),
      initialPageParam: null,
    });
    mount();

    emit({ type: "message:new", chatId: "c1", message: message("m2") });
    // The page was read before the message arrived.
    resolvePage({ messages: [message("m1")], authors: [], nextCursor: null });
    await act(() => loading);

    await waitFor(() => expect(messageIds()).toEqual(["m1", "m2"]));
  });

  it("keeps a message received while the conversation reloads", async () => {
    const queryKey = chatKeys.messages(CHAT_REF);
    const firstPage = (): ChatMessagesPage => ({
      messages: [message("m1")],
      authors: [],
      nextCursor: null,
    });
    await queryClient.fetchInfiniteQuery({
      queryKey,
      queryFn: async () => firstPage(),
      initialPageParam: null,
    });
    let resolvePage: (page: ChatMessagesPage) => void = () => {};
    const reloading = queryClient.fetchInfiniteQuery({
      queryKey,
      queryFn: () =>
        new Promise<ChatMessagesPage>((resolve) => {
          resolvePage = resolve;
        }),
      initialPageParam: null,
      staleTime: 0,
    });
    mount();

    emit({ type: "message:new", chatId: "c1", message: message("m2") });
    expect(messageIds()).toEqual(["m1", "m2"]);
    resolvePage(firstPage());
    await act(() => reloading);

    await waitFor(() => expect(messageIds()).toEqual(["m1", "m2"]));
  });

  it("appends recent live messages missing from a reloaded window", () => {
    const ref: ChatRef = { accountId: "account-a", chatId: "c-replay" };
    mount();
    emit({ type: "message:new", chatId: "c-replay", message: message("m2") });

    // A window loaded around an unread message, read before m2 arrived.
    seedMessages(queryClient, ref, [message("m1")], []);
    replayRecentLiveMessages(queryClient, ref);

    expect(messageIds(ref)).toEqual(["m1", "m2"]);
  });

  it("keeps the reaction order on reaction:updated", () => {
    seedMessages(
      queryClient,
      CHAT_REF,
      [
        {
          ...message("m1"),
          reactions: [
            { emoji: "👍", count: 1, reactedByMe: false },
            { emoji: "✅", count: 1, reactedByMe: false },
          ],
        },
      ],
      [],
    );
    mount();

    emit({
      type: "reaction:updated",
      chatId: "c1",
      messageId: "m1",
      reactions: [
        { emoji: "✅", count: 2, reactedByMe: false },
        { emoji: "👍", count: 1, reactedByMe: false },
      ],
    });

    const data = queryClient.getQueryData<InfiniteData<ChatMessagesPage>>(
      chatKeys.messages(CHAT_REF),
    );
    expect(data?.pages[0].messages[0].reactions.map((r) => r.emoji)).toEqual([
      "👍",
      "✅",
    ]);
  });

  it("leaves the reactions of a toggle in flight to the toggle", () => {
    const optimistic = [{ emoji: "👍", count: 1, reactedByMe: true }];
    seedMessages(
      queryClient,
      CHAT_REF,
      [{ ...message("m1"), reactions: optimistic }],
      [],
    );
    mount();
    beginReactionToggle(CHAT_REF, "m1");
    try {
      // Both were read before the toggle reached the homeserver.
      emit({
        type: "reaction:updated",
        chatId: "c1",
        messageId: "m1",
        reactions: [],
      });
      emit({
        type: "message:updated",
        chatId: "c1",
        message: { ...message("m1"), content: "edited", reactions: [] },
      });
    } finally {
      endReactionToggle(CHAT_REF, "m1");
    }

    const [updated] =
      queryClient.getQueryData<InfiniteData<ChatMessagesPage>>(
        chatKeys.messages(CHAT_REF),
      )?.pages[0].messages ?? [];
    expect(updated.content).toBe("edited");
    expect(updated.reactions).toEqual(optimistic);
  });

  const seedThread = (threadId: string, messages: ChatMessage[]) =>
    queryClient.setQueryData<ChatThreadDetail>(
      chatKeys.thread(CHAT_REF, threadId),
      {
        id: threadId,
        rootMessageId: threadId,
        messages,
        authors: [author("a-1")],
        firstUnreadIndex: null,
      },
    );
  const threadMessageIds = (threadId: string) =>
    queryClient
      .getQueryData<ChatThreadDetail>(chatKeys.thread(CHAT_REF, threadId))
      ?.messages.map((m) => m.id);

  it("adds a new reply to its own thread only", () => {
    seedThread("t1", [message("t1")]);
    seedThread("t2", [message("t2")]);
    mount();

    emit({
      type: "thread:reply",
      chatId: "c1",
      threadId: "t1",
      message: message("r1"),
      authors: [author("a-2")],
    });

    expect(threadMessageIds("t1")).toEqual(["t1", "r1"]);
    expect(threadMessageIds("t2")).toEqual(["t2"]);
    expect(
      queryClient
        .getQueryData<ChatThreadDetail>(chatKeys.thread(CHAT_REF, "t1"))
        ?.authors.map((a) => a.id),
    ).toEqual(["a-1", "a-2"]);
  });

  it("replaces a reply placeholder once it decrypts", () => {
    seedThread("t1", [
      message("t1"),
      { ...message("r1"), content: "awaiting decryption" },
    ]);
    mount();

    emit({
      type: "thread:reply",
      chatId: "c1",
      threadId: "t1",
      message: { ...message("r1"), content: "decrypted" },
    });

    const detail = queryClient.getQueryData<ChatThreadDetail>(
      chatKeys.thread(CHAT_REF, "t1"),
    );
    expect(detail?.messages.map((m) => m.content)).toEqual(["t1", "decrypted"]);
  });

  it("reloads only the thread a change names", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mount();

    emit({ type: "threads:changed", chatId: "c1", threadId: "t1" });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: chatKeys.thread(CHAT_REF, "t1"),
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: chatKeys.threadDetails(CHAT_REF),
    });
  });

  it("leaves open threads alone when only the thread lists change", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mount();

    emit({ type: "threads:changed", chatId: "c1", invalidateDetails: false });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: chatKeys.threads(CHAT_REF),
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
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
      { type: "members:changed", chatId: "c1" },
      ["chat-members", "account-a", "c1"],
    ],
    [{ type: "tags:changed", chatId: "c1" }, ["chat", "account-a", "c1"]],
    [{ type: "chats:changed" }, ["chats", "account-a"]],
  ])("INVALIDATES the right cache on %o", (event, queryKey) => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mount();

    emit(event);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
  });
});
