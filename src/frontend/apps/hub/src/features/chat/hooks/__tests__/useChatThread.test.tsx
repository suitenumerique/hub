// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GetChatThreadParams } from "@/features/drivers/Driver";
import type {
  ChatMessage,
  ChatRef,
  ChatThreadDetail,
} from "@/features/drivers/types";

import { chatKeys } from "../../chatKeys";
import { useChatThread } from "../useChatThread";

const message = (id: string, minute: number): ChatMessage => ({
  id,
  authorId: "a-1",
  content: id,
  timestamp: `2026-05-12T09:${String(minute).padStart(2, "0")}:00.000Z`,
  reactions: [],
});

const ROOT = message("m-1", 0);

const buildDetail = (
  replies: ChatMessage[] = [message("t-1-r1", 5)],
  hasOlderReplies = false,
): ChatThreadDetail => ({
  id: "t-1",
  rootMessageId: "m-1",
  messages: [ROOT, ...replies],
  authors: [
    { id: "a-1", name: "Ada Lovelace", initials: "AL", color: "blue-1" },
  ],
  firstUnreadIndex: 1,
  hasOlderReplies,
});

/** Settles when `resolve` is called, to observe a load while it runs. */
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const getChatThread =
  vi.fn<(params: GetChatThreadParams) => Promise<ChatThreadDetail>>();
const loadOlderChatThreadReplies =
  vi.fn<(params: GetChatThreadParams) => Promise<void>>();

const registry = {
  get: vi.fn(() => ({
    getChatThread,
    loadOlderChatThreadReplies,
  })),
};

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => registry,
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };
const PARAMS = { chatId: "chat-1", threadId: "t-1" };

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
    loadOlderChatThreadReplies.mockReset().mockResolvedValue();
    registry.get.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderThread = (threadId = "t-1") =>
    renderHook(({ id }) => useChatThread(CHAT_REF, id), {
      initialProps: { id: threadId },
      wrapper: wrapper(queryClient),
    });

  it("loads a thread keyed by chatId and threadId", async () => {
    getChatThread.mockResolvedValueOnce(buildDetail());

    const { result } = renderThread();

    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.thread).toBeNull();

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(getChatThread).toHaveBeenCalledWith(PARAMS);
    expect(registry.get).toHaveBeenCalledWith("account-a");
    expect(result.current.thread?.messages).toHaveLength(2);
    expect(result.current.thread?.firstUnreadIndex).toBe(1);
  });

  it("surfaces query errors without throwing", async () => {
    getChatThread.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderThread();

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.thread).toBeNull();
    expect(result.current.messages).toEqual([]);
  });

  it("shows a thread already in the cache at once", () => {
    queryClient.setQueryData(chatKeys.thread(CHAT_REF, "t-1"), buildDetail());

    const { result } = renderThread();

    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.messages.map((m) => m.id)).toEqual(["m-1", "t-1-r1"]);
  });

  it("keeps the root for the top of the thread while older replies remain", async () => {
    getChatThread.mockResolvedValueOnce(buildDetail(undefined, true));

    const { result } = renderThread();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    expect(result.current.hasOlder).toBe(true);
    expect(result.current.messages.map((m) => m.id)).toEqual(["t-1-r1"]);
    // The thread itself still names its root.
    expect(result.current.thread?.messages[0].id).toBe("m-1");
  });

  it("loads older replies above the shown ones without moving them", async () => {
    getChatThread
      .mockResolvedValueOnce(
        buildDetail([message("t-1-r3", 3), message("t-1-r4", 4)], true),
      )
      .mockResolvedValue(
        buildDetail([
          message("t-1-r1", 1),
          message("t-1-r2", 2),
          message("t-1-r3", 3),
          message("t-1-r4", 4),
        ]),
      );
    const load = deferred();
    loadOlderChatThreadReplies.mockReturnValueOnce(load.promise);

    const { result } = renderThread();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    const shownIndex = result.current.firstItemIndex;

    act(() => result.current.fetchOlder());
    await waitFor(() => expect(result.current.isFetchingOlder).toBe(true));
    load.resolve();
    await waitFor(() => expect(result.current.isFetchingOlder).toBe(false));

    expect(loadOlderChatThreadReplies).toHaveBeenCalledOnce();
    expect(loadOlderChatThreadReplies).toHaveBeenCalledWith(PARAMS);
    expect(result.current.hasOlder).toBe(false);
    expect(result.current.messages.map((m) => m.id)).toEqual([
      "m-1",
      "t-1-r1",
      "t-1-r2",
      "t-1-r3",
      "t-1-r4",
    ]);
    // The root and two replies came above "t-1-r3", which keeps its index.
    expect(result.current.firstItemIndex).toBe(shownIndex - 3);
  });

  it("asks again once a load ends when the top was reached meanwhile", async () => {
    getChatThread
      .mockResolvedValueOnce(buildDetail([message("t-1-r5", 5)], true))
      .mockResolvedValueOnce(
        buildDetail([message("t-1-r4", 4), message("t-1-r5", 5)], true),
      )
      .mockResolvedValue(
        buildDetail([
          message("t-1-r3", 3),
          message("t-1-r4", 4),
          message("t-1-r5", 5),
        ]),
      );
    const firstLoad = deferred();
    loadOlderChatThreadReplies.mockReturnValueOnce(firstLoad.promise);

    const { result } = renderThread();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => result.current.fetchOlder());
    await waitFor(() => expect(result.current.isFetchingOlder).toBe(true));
    act(() => result.current.fetchOlder());
    firstLoad.resolve();

    await waitFor(() =>
      expect(loadOlderChatThreadReplies).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(result.current.hasOlder).toBe(false));
    expect(result.current.messages[0].id).toBe("m-1");
  });

  it("shows a failed load and retries it", async () => {
    getChatThread
      .mockResolvedValueOnce(buildDetail(undefined, true))
      .mockResolvedValue(buildDetail([message("t-1-r0", 1)]));
    loadOlderChatThreadReplies.mockRejectedValueOnce(new Error("offline"));

    const { result } = renderThread();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => result.current.fetchOlder());
    await waitFor(() => expect(result.current.isFetchOlderError).toBe(true));
    expect(result.current.isFetchingOlder).toBe(false);
    expect(result.current.hasOlder).toBe(true);

    act(() => result.current.fetchOlder());
    await waitFor(() => expect(result.current.hasOlder).toBe(false));

    expect(loadOlderChatThreadReplies).toHaveBeenCalledTimes(2);
    expect(result.current.isFetchOlderError).toBe(false);
  });

  it("does not report another thread's load as this one's", async () => {
    getChatThread.mockImplementation(async ({ threadId }) => ({
      ...buildDetail(undefined, true),
      id: threadId,
    }));
    loadOlderChatThreadReplies.mockReturnValueOnce(new Promise(() => {}));

    const { result, rerender } = renderThread("t-1");
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    act(() => result.current.fetchOlder());
    await waitFor(() => expect(result.current.isFetchingOlder).toBe(true));

    rerender({ id: "t-2" });
    await waitFor(() => expect(result.current.thread?.id).toBe("t-2"));

    expect(result.current.isFetchingOlder).toBe(false);
    act(() => result.current.fetchOlder());
    await waitFor(() =>
      expect(loadOlderChatThreadReplies).toHaveBeenLastCalledWith({
        chatId: "chat-1",
        threadId: "t-2",
      }),
    );
  });

  it("keeps the first index when a reply is added below", async () => {
    getChatThread.mockResolvedValueOnce(buildDetail());

    const { result } = renderThread();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    const shownIndex = result.current.firstItemIndex;

    act(() => {
      queryClient.setQueryData(
        chatKeys.thread(CHAT_REF, "t-1"),
        buildDetail([message("t-1-r1", 5), message("t-1-r2", 6)]),
      );
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    expect(result.current.firstItemIndex).toBe(shownIndex);
  });

  it("asks for nothing older once the thread starts at its root", async () => {
    getChatThread.mockResolvedValueOnce(buildDetail());

    const { result } = renderThread();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => result.current.fetchOlder());

    expect(loadOlderChatThreadReplies).not.toHaveBeenCalled();
  });
});
