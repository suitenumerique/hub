// @vitest-environment jsdom
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";

import { chatKeys } from "../../chatKeys";
import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessagesPage,
  ChatRef,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
} from "@/features/drivers/types";

import { useSendChatMessage } from "../useSendChatMessage";
import { useSendChatThreadReply } from "../useSendChatThreadReply";
import { useStartChatThread } from "../useStartChatThread";

const sendChatMessage = vi.fn();
const sendChatThreadReply = vi.fn();
const startChatThread = vi.fn();

const driver = {
  supportsComposition: true,
  supportsThreadComposition: true,
  sendChatMessage,
  sendChatThreadReply,
  startChatThread,
};

const registry = {
  get: vi.fn(() => driver),
};

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => registry,
  useDriverEntries: () => [
    {
      accountId: "account-a",
      kind: "mock",
      label: "Account A",
      criticality: "required",
      enabled: true,
      driver,
    },
  ],
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };
const THREAD_ID = "thread-1";

const message = (id: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  authorId: "alice",
  content: id,
  timestamp: "2026-05-12T10:00:00.000Z",
  reactions: [],
  ...over,
});

const aliceAuthor: ChatMessageAuthor = {
  id: "alice",
  name: "Alice",
  initials: "A",
  color: "blue-1",
};

const thread = (over: Partial<ChatThread> = {}): ChatThread => ({
  id: THREAD_ID,
  rootMessageId: "m-root",
  author: aliceAuthor,
  lastReplyAt: "2026-05-12T10:05:00.000Z",
  lastReplyPreview: "Existing reply",
  replyCount: 1,
  unreadCount: 0,
  ...over,
});

const detail = (messages: ChatMessage[]): ChatThreadDetail => ({
  id: THREAD_ID,
  rootMessageId: "m-root",
  messages,
  authors: [aliceAuthor],
  firstUnreadIndex: null,
});

const messagesData = (
  messages: ChatMessage[],
): InfiniteData<ChatMessagesPage> => ({
  pages: [{ messages, authors: [], nextCursor: null }],
  pageParams: [null],
});

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

describe("chat composition hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    sendChatMessage.mockReset();
    sendChatThreadReply.mockReset();
    startChatThread.mockReset();
    registry.get.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("optimistically appends a conversation message and replaces it on success", async () => {
    let resolveSend: (message: ChatMessage) => void = () => {};
    sendChatMessage.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );
    queryClient.setQueryData(
      chatKeys.messages(CHAT_REF),
      messagesData([message("m-1")]),
    );

    const { result } = renderHook(() => useSendChatMessage(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      void result.current.sendMessage("Hello");
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<InfiniteData<ChatMessagesPage>>(
        chatKeys.messages(CHAT_REF),
      );
      expect(data?.pages[0].messages.map((item) => item.content)).toContain(
        "Hello",
      );
    });

    act(() => {
      resolveSend(
        message("m-sent", {
          authorId: "me",
          content: "Hello",
        }),
      );
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<InfiniteData<ChatMessagesPage>>(
        chatKeys.messages(CHAT_REF),
      );
      expect(data?.pages[0].messages.map((item) => item.id)).toContain(
        "m-sent",
      );
      expect(
        data?.pages[0].messages.some((item) =>
          item.id.startsWith("optimistic-message"),
        ),
      ).toBe(false);
    });
  });

  it("rolls back a failed conversation send", async () => {
    let rejectSend: (error: Error) => void = () => {};
    sendChatMessage.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectSend = reject;
      }),
    );
    queryClient.setQueryData(
      chatKeys.messages(CHAT_REF),
      messagesData([message("m-1")]),
    );

    const { result } = renderHook(() => useSendChatMessage(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });

    let promise: Promise<ChatMessage> | undefined;
    act(() => {
      promise = result.current.sendMessage("Rollback me");
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<InfiniteData<ChatMessagesPage>>(
        chatKeys.messages(CHAT_REF),
      );
      expect(data?.pages[0].messages).toHaveLength(2);
    });

    act(() => {
      rejectSend(new Error("network"));
    });
    await expect(promise).rejects.toThrow();

    await waitFor(() => {
      const data = queryClient.getQueryData<InfiniteData<ChatMessagesPage>>(
        chatKeys.messages(CHAT_REF),
      );
      expect(data?.pages[0].messages.map((item) => item.id)).toEqual(["m-1"]);
    });
  });

  it("updates thread detail, thread list and root summary for a reply", async () => {
    const root = message("m-root", {
      thread: { id: THREAD_ID, replyCount: 1, unreadCount: 0 },
    });
    const reply = message("reply-real", {
      authorId: "me",
      content: "A new reply",
    });
    const updatedThread = thread({
      // Matrix's aggregate may still be one event behind the local timeline
      // when the send promise resolves.
      replyCount: 1,
      lastReplyPreview: "A new reply",
    });
    const updatedRoot = {
      ...root,
      thread: { id: THREAD_ID, replyCount: 1, unreadCount: 0 },
    };
    const mutationResult: ChatThreadMutationResult = {
      message: reply,
      thread: updatedThread,
      threadDetail: detail([updatedRoot, message("old-reply"), reply]),
      rootMessage: updatedRoot,
    };
    sendChatThreadReply.mockResolvedValue(mutationResult);

    queryClient.setQueryData(chatKeys.messages(CHAT_REF), messagesData([root]));
    queryClient.setQueryData(chatKeys.threads(CHAT_REF), [thread()]);
    queryClient.setQueryData(
      chatKeys.thread(CHAT_REF, THREAD_ID),
      detail([root, message("old-reply")]),
    );

    const { result } = renderHook(
      () => useSendChatThreadReply(CHAT_REF, THREAD_ID),
      {
        wrapper: wrapper(queryClient),
      },
    );

    act(() => {
      void result.current.sendReply("A new reply");
    });

    await waitFor(() => {
      expect(
        queryClient
          .getQueryData<ChatThreadDetail>(chatKeys.thread(CHAT_REF, THREAD_ID))
          ?.messages.some((item) => item.content === "A new reply"),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData<ChatThread[]>(chatKeys.threads(CHAT_REF))?.[0]
          .replyCount,
      ).toBe(2);
      expect(
        queryClient.getQueryData<InfiniteData<ChatMessagesPage>>(
          chatKeys.messages(CHAT_REF),
        )?.pages[0].messages[0].thread?.replyCount,
      ).toBe(2);
    });
  });

  it("starts a thread with optimistic root summary and replaces it on success", async () => {
    let resolveStart: (result: ChatThreadMutationResult) => void = () => {};
    const root = message("m-root");
    const reply = message("reply-real", {
      authorId: "me",
      content: "First reply",
    });
    const updatedRoot = {
      ...root,
      thread: { id: "thread-real", replyCount: 1, unreadCount: 0 },
    };
    const mutationResult: ChatThreadMutationResult = {
      message: reply,
      thread: thread({
        id: "thread-real",
        rootMessageId: root.id,
        replyCount: 1,
        lastReplyPreview: "First reply",
      }),
      threadDetail: {
        ...detail([updatedRoot, reply]),
        id: "thread-real",
        rootMessageId: root.id,
      },
      rootMessage: updatedRoot,
    };
    startChatThread.mockReturnValue(
      new Promise((resolve) => {
        resolveStart = resolve;
      }),
    );
    queryClient.setQueryData(chatKeys.messages(CHAT_REF), messagesData([root]));
    queryClient.setQueryData(chatKeys.threads(CHAT_REF), []);

    const { result } = renderHook(() => useStartChatThread(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });
    const onOptimisticThread = vi.fn();
    const onCreated = vi.fn();

    act(() => {
      void result.current.startThread(root, "First reply", {
        rootAuthor: aliceAuthor,
        onOptimisticThread,
        onCreated,
      });
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData<InfiniteData<ChatMessagesPage>>(
          chatKeys.messages(CHAT_REF),
        )?.pages[0].messages[0].thread?.replyCount,
      ).toBe(1);
    });
    expect(onOptimisticThread).toHaveBeenCalledWith(
      expect.stringMatching(/^optimistic-thread-/),
    );
    const optimisticThreadId = onOptimisticThread.mock.calls[0][0] as string;
    const optimisticDetail = queryClient.getQueryData<ChatThreadDetail>(
      chatKeys.thread(CHAT_REF, optimisticThreadId),
    );
    expect(optimisticDetail?.messages).toHaveLength(2);
    expect(optimisticDetail?.authors).toEqual([aliceAuthor]);

    act(() => {
      resolveStart(mutationResult);
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData<ChatThread[]>(chatKeys.threads(CHAT_REF))?.[0]
          .id,
      ).toBe("thread-real");
      expect(
        queryClient.getQueryData<ChatThreadDetail>(
          chatKeys.thread(CHAT_REF, "thread-real"),
        )?.messages,
      ).toHaveLength(2);
      expect(onCreated).toHaveBeenCalledWith("thread-real");
      expect(
        queryClient.getQueryData(chatKeys.thread(CHAT_REF, optimisticThreadId)),
      ).toBeUndefined();
    });
  });
});
