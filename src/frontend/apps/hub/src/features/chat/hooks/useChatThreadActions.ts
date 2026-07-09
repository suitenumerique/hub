import {
  type InfiniteData,
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMessagesPage,
  ChatRef,
  ChatThread,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

type ChatMessagesData = InfiniteData<ChatMessagesPage>;

type ThreadMatcher = (threadId: string) => boolean;

type ReadContext = {
  threadsKey: QueryKey;
  messagesKey: QueryKey;
  affectedThreadIds: string[];
  previousThreadUnread: Record<string, number>;
  previousRootUnread: Record<string, number>;
};

/**
 * Clears the unread badge of the matching threads' root messages across every
 * loaded page, producing fresh `ChatMessage` objects only for the touched rows
 * so the memoized virtual-list bubbles re-render their thread button.
 */
const clearThreadBadges = (
  data: ChatMessagesData,
  matches: ThreadMatcher,
): ChatMessagesData => ({
  ...data,
  pages: data.pages.map((page) => {
    const touched = page.messages.some(
      (message) =>
        message.thread !== undefined &&
        message.thread.unreadCount !== 0 &&
        matches(message.thread.id),
    );
    if (!touched) {
      return page;
    }
    return {
      ...page,
      messages: page.messages.map((message) =>
        message.thread !== undefined &&
        message.thread.unreadCount !== 0 &&
        matches(message.thread.id)
          ? { ...message, thread: { ...message.thread, unreadCount: 0 } }
          : message,
      ),
    };
  }),
});

const rootUnreadByThreadId = (
  data: ChatMessagesData | undefined,
  matches: ThreadMatcher,
): Record<string, number> =>
  Object.fromEntries(
    (data?.pages ?? [])
      .flatMap((page) => page.messages)
      .flatMap((message) => (message.thread ? [message.thread] : []))
      .filter((thread) => matches(thread.id))
      .map((thread) => [thread.id, thread.unreadCount]),
  );

/** Restore only badges still carrying our optimistic zero. */
const restoreThreadBadges = (
  data: ChatMessagesData,
  affectedThreadIds: Set<string>,
  previousUnread: Record<string, number>,
): ChatMessagesData => ({
  ...data,
  pages: data.pages.map((page) => ({
    ...page,
    messages: page.messages.map((message) => {
      const thread = message.thread;
      if (
        !thread ||
        !affectedThreadIds.has(thread.id) ||
        thread.unreadCount !== 0 ||
        previousUnread[thread.id] === undefined
      ) {
        return message;
      }
      return {
        ...message,
        thread: { ...thread, unreadCount: previousUnread[thread.id] },
      };
    }),
  })),
});

export type UseChatThreadActionsResult = {
  /** Marks every reply of a single thread as read. */
  markThreadRead: (threadId: string) => void;
  /** Marks every thread of the conversation as read. */
  markAllRead: () => void;
};

/**
 * Mutations that clear thread unread state through the driver. Each mutation
 * optimistically updates both the `["chat-threads", chatId]` cache (the panel
 * and the unread banner) and the `["chat-messages", chatId]` cache (the thread
 * button on the root bubble). A failed receipt is retried, then only its own
 * zeroed badges are restored so a concurrently received reply is never lost.
 */
export const useChatThreadActions = (
  ref: ChatRef,
): UseChatThreadActionsResult => {
  const queryClient = useQueryClient();

  const applyOptimisticRead = async (
    matches: ThreadMatcher,
  ): Promise<ReadContext> => {
    const threadsKey: QueryKey = chatKeys.threads(ref);
    const messagesKey: QueryKey = chatKeys.messages(ref);
    // Stop any in-flight refetch from overwriting the optimistic write.
    await queryClient.cancelQueries({ queryKey: threadsKey });
    await queryClient.cancelQueries({ queryKey: messagesKey });
    const previousThreads = queryClient.getQueryData<ChatThread[]>(threadsKey);
    const previousMessages =
      queryClient.getQueryData<ChatMessagesData>(messagesKey);
    const previousThreadUnread = Object.fromEntries(
      (previousThreads ?? [])
        .filter((thread) => matches(thread.id))
        .map((thread) => [thread.id, thread.unreadCount]),
    );
    const previousRootUnread = rootUnreadByThreadId(previousMessages, matches);
    const affectedThreadIds = [
      ...new Set([
        ...Object.keys(previousThreadUnread),
        ...Object.keys(previousRootUnread),
      ]),
    ];
    queryClient.setQueryData<ChatThread[]>(threadsKey, (old) =>
      old?.map((thread) =>
        matches(thread.id) ? { ...thread, unreadCount: 0 } : thread,
      ),
    );
    queryClient.setQueryData<ChatMessagesData>(messagesKey, (old) =>
      old ? clearThreadBadges(old, matches) : old,
    );
    return {
      threadsKey,
      messagesKey,
      affectedThreadIds,
      previousThreadUnread,
      previousRootUnread,
    };
  };

  const rollback = (context: ReadContext | undefined) => {
    if (!context) {
      return;
    }
    const affectedThreadIds = new Set(context.affectedThreadIds);
    queryClient.setQueryData<ChatThread[]>(context.threadsKey, (current) =>
      current?.map((thread) =>
        affectedThreadIds.has(thread.id) &&
        thread.unreadCount === 0 &&
        context.previousThreadUnread[thread.id] !== undefined
          ? {
              ...thread,
              unreadCount: context.previousThreadUnread[thread.id],
            }
          : thread,
      ),
    );
    queryClient.setQueryData<ChatMessagesData>(
      context.messagesKey,
      (current) =>
        current
          ? restoreThreadBadges(
              current,
              affectedThreadIds,
              context.previousRootUnread,
            )
          : current,
    );
    void queryClient.invalidateQueries({ queryKey: context.threadsKey });
    void queryClient.invalidateQueries({ queryKey: context.messagesKey });
  };

  // `mutate` is a stable reference across renders — destructuring it keeps the
  // returned callbacks stable, so callers can safely use them in effect deps.
  const { mutate: mutateThreadRead } = useMutation<
    unknown,
    Error,
    string,
    ReadContext
  >({
    mutationFn: (threadId: string) =>
      getRegistry()
        .get(ref.accountId)
        .markChatThreadRead({ chatId: ref.chatId, threadId }),
    onMutate: (threadId) => applyOptimisticRead((id) => id === threadId),
    onError: (_error, _variables, context) => rollback(context),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 8_000),
    meta: { noGlobalError: true },
  });

  const { mutate: mutateAllRead } = useMutation<
    unknown,
    Error,
    void,
    ReadContext
  >({
    mutationFn: () =>
      getRegistry().get(ref.accountId).markAllChatThreadsRead(ref.chatId),
    onMutate: () => applyOptimisticRead(() => true),
    onError: (_error, _variables, context) => rollback(context),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 8_000),
    meta: { noGlobalError: true },
  });

  const markThreadRead = useCallback(
    (threadId: string) => {
      mutateThreadRead(threadId);
    },
    [mutateThreadRead],
  );

  const markAllRead = useCallback(() => {
    mutateAllRead();
  }, [mutateAllRead]);

  return { markThreadRead, markAllRead };
};
