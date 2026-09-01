import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef, ChatThread } from "@/features/drivers/types";

import { chatKeys, type ChatMessageWindowQueryKey } from "../chatKeys";

import {
  type ChatMessagesData,
  getOptimisticRootThreadUnreadMarker,
  getOptimisticThreadUnreadMarker,
  hasOptimisticRootThreadUnreadMutation,
  hasOptimisticThreadUnreadMutation,
  markOptimisticRootThreadUnread,
  markOptimisticThreadUnread,
  type ThreadUnreadMutationMarker,
} from "./chatCompositionCache";

type ThreadMatcher = (threadId: string) => boolean;

type PreviousUnreadState = {
  unreadCount: number;
  marker?: ThreadUnreadMutationMarker;
};

type MessageWindowReadSnapshot = {
  queryKey: ChatMessageWindowQueryKey;
  previousRootUnread: Record<string, PreviousUnreadState>;
};

type ReadContext = {
  marker: ThreadUnreadMutationMarker;
  threadsKey: QueryKey;
  messageWindows: MessageWindowReadSnapshot[];
  previousThreadUnread: Record<string, PreviousUnreadState>;
};

/**
 * Clears the unread badge of the matching threads' root messages in the cached
 * snapshot, producing fresh `ChatMessage` objects only for the touched rows
 * so the memoized virtual-list bubbles re-render their thread button.
 */
const clearThreadBadges = (
  data: ChatMessagesData,
  matches: ThreadMatcher,
  marker: ThreadUnreadMutationMarker,
): ChatMessagesData => {
  const snapshot = data.pages[0];
  const touched = snapshot?.messages.some((message) => {
    const thread = message.thread;
    return (
      thread !== undefined &&
      matches(thread.id) &&
      (thread.unreadCount !== 0 ||
        getOptimisticRootThreadUnreadMarker(thread) !== undefined)
    );
  });
  if (!snapshot || !touched) {
    return data;
  }
  return {
    ...data,
    pages: [
      {
        ...snapshot,
        messages: snapshot.messages.map((message) =>
          message.thread !== undefined &&
          matches(message.thread.id) &&
          (message.thread.unreadCount !== 0 ||
            getOptimisticRootThreadUnreadMarker(message.thread) !== undefined)
            ? {
                ...message,
                thread: markOptimisticRootThreadUnread(
                  message.thread,
                  marker,
                ),
              }
            : message,
        ),
      },
    ],
  };
};

const rootUnreadStateByThreadId = (
  data: ChatMessagesData | undefined,
  matches: ThreadMatcher,
): Record<string, PreviousUnreadState> =>
  Object.fromEntries(
    (data?.pages[0]?.messages ?? [])
      .flatMap((message) => (message.thread ? [message.thread] : []))
      .filter(
        (thread) =>
          matches(thread.id) &&
          (thread.unreadCount !== 0 ||
            getOptimisticRootThreadUnreadMarker(thread) !== undefined),
      )
      .map((thread) => {
        const marker = getOptimisticRootThreadUnreadMarker(thread);
        return [
          thread.id,
          {
            unreadCount: thread.unreadCount,
            ...(marker ? { marker } : {}),
          },
        ];
      }),
  );

/** Restore only badges still carrying our optimistic zero. */
const restoreThreadBadges = (
  data: ChatMessagesData,
  previousUnread: Record<string, PreviousUnreadState>,
  marker: ThreadUnreadMutationMarker,
): ChatMessagesData => {
  const snapshot = data.pages[0];
  if (!snapshot) {
    return data;
  }
  let changed = false;
  const messages = snapshot.messages.map((message) => {
    const thread = message.thread;
    const previous = thread ? previousUnread[thread.id] : undefined;
    if (
      !thread ||
      !hasOptimisticRootThreadUnreadMutation(thread, marker) ||
      !previous
    ) {
      return message;
    }
    changed = true;
    const restored = { ...thread, unreadCount: previous.unreadCount };
    return {
      ...message,
      thread: previous.marker
        ? markOptimisticRootThreadUnread(restored, previous.marker)
        : restored,
    };
  });
  return changed
    ? { ...data, pages: [{ ...snapshot, messages }] }
    : data;
};

export type UseChatThreadActionsResult = {
  /** Marks every reply of a single thread as read. */
  markThreadRead: (threadId: string) => void;
  /** Marks every thread of the conversation as read. */
  markAllRead: () => void;
};

/**
 * Mutations that clear thread unread state through the driver. Each mutation
 * optimistically updates the thread list and main-timeline snapshot. A
 * failed receipt is retried, then only badges still carrying this mutation's
 * marker are restored, so a concurrent reply or receipt always wins.
 */
export const useChatThreadActions = (
  ref: ChatRef,
): UseChatThreadActionsResult => {
  const queryClient = useQueryClient();

  const applyOptimisticRead = async (
    matches: ThreadMatcher,
  ): Promise<ReadContext> => {
    const threadsKey: QueryKey = chatKeys.threads(ref);
    const messageWindowKeys = [chatKeys.messages(ref)];
    // Stop any in-flight refetch from overwriting the optimistic write.
    await Promise.all([
      queryClient.cancelQueries({ queryKey: threadsKey }),
      ...messageWindowKeys.map((queryKey) =>
        queryClient.cancelQueries({ queryKey, exact: true }),
      ),
    ]);
    const previousThreads = queryClient.getQueryData<ChatThread[]>(threadsKey);
    const previousThreadUnread = Object.fromEntries(
      (previousThreads ?? [])
        .filter(
          (thread) =>
            matches(thread.id) &&
            (thread.unreadCount !== 0 ||
              getOptimisticThreadUnreadMarker(thread) !== undefined),
        )
        .map((thread) => {
          const marker = getOptimisticThreadUnreadMarker(thread);
          return [
            thread.id,
            {
              unreadCount: thread.unreadCount,
              ...(marker ? { marker } : {}),
            },
          ];
        }),
    );
    const messageWindows = messageWindowKeys.map((queryKey) => ({
      queryKey,
      previousRootUnread: rootUnreadStateByThreadId(
        queryClient.getQueryData<ChatMessagesData>(queryKey),
        matches,
      ),
    }));
    const marker: ThreadUnreadMutationMarker = {};
    queryClient.setQueryData<ChatThread[]>(threadsKey, (old) =>
      old?.map((thread) =>
        matches(thread.id) &&
        (thread.unreadCount !== 0 ||
          getOptimisticThreadUnreadMarker(thread) !== undefined)
          ? markOptimisticThreadUnread({ ...thread, unreadCount: 0 }, marker)
          : thread,
      ),
    );
    messageWindows.forEach(({ queryKey }) => {
      queryClient.setQueryData<ChatMessagesData>(queryKey, (old) =>
        old ? clearThreadBadges(old, matches, marker) : old,
      );
    });
    return {
      marker,
      threadsKey,
      messageWindows,
      previousThreadUnread,
    };
  };

  const rollback = (context: ReadContext | undefined) => {
    if (!context) {
      return;
    }
    queryClient.setQueryData<ChatThread[]>(context.threadsKey, (current) =>
      current?.map((thread) => {
        const previous = context.previousThreadUnread[thread.id];
        if (
          !previous ||
          !hasOptimisticThreadUnreadMutation(thread, context.marker)
        ) {
          return thread;
        }
        const restored = { ...thread, unreadCount: previous.unreadCount };
        return previous.marker
          ? markOptimisticThreadUnread(restored, previous.marker)
          : restored;
      }),
    );
    context.messageWindows.forEach(({ queryKey, previousRootUnread }) => {
      queryClient.setQueryData<ChatMessagesData>(queryKey, (current) =>
        current
          ? restoreThreadBadges(current, previousRootUnread, context.marker)
          : current,
      );
    });
    void queryClient.invalidateQueries({ queryKey: context.threadsKey });
    context.messageWindows.forEach(({ queryKey }) => {
      void queryClient.invalidateQueries({ queryKey });
    });
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
