import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { getThreadAttentionUnreadCount } from "@/features/chat/chatNotificationPolicy";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef, ChatThread } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import {
  isChatThreadMuted,
  useChatNotificationPreferences,
} from "./useChatNotificationPreferences";

export type UseChatThreadsResult = {
  threads: ChatThread[];
  /** Threads requiring attention; muted threads expose mentions only. */
  unreadThreads: ChatThread[];
  isInitialLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const EMPTY: ChatThread[] = [];

/**
 * Loads the threads of a conversation through the driver. The query is keyed by
 * `chatId`, so the threads stay scoped to the active conversation; the threads
 * panel and the unread banner share this single cache entry.
 */
export const useChatThreads = (ref: ChatRef): UseChatThreadsResult => {
  const getNotificationPreferences = useChatNotificationPreferences();
  const notificationPreferences = getNotificationPreferences(ref);
  const query = useQuery({
    queryKey: chatKeys.threads(ref),
    queryFn: () => getRegistry().get(ref.accountId).getChatThreads(ref.chatId),
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  const threads = useMemo(() => {
    const data = query.data ?? EMPTY;
    // Muted threads stay visible after active threads; each group keeps recency.
    return [...data].sort((left, right) => {
      const leftMuted = isChatThreadMuted(notificationPreferences, left.id);
      const rightMuted = isChatThreadMuted(notificationPreferences, right.id);
      if (leftMuted !== rightMuted) {
        return leftMuted ? 1 : -1;
      }
      return (
        Date.parse(right.lastReplyAt) - Date.parse(left.lastReplyAt) ||
        left.id.localeCompare(right.id)
      );
    });
  }, [notificationPreferences, query.data]);

  const unreadThreads = useMemo(
    () =>
      threads.filter(
        (thread) =>
          getThreadAttentionUnreadCount({
            threadMuted: isChatThreadMuted(notificationPreferences, thread.id),
            unreadCount: thread.unreadCount,
            highlightCount: thread.highlightCount,
          }) > 0,
      ),
    [notificationPreferences, threads],
  );

  return {
    threads,
    unreadThreads,
    isInitialLoading: query.isPending,
    isError: query.isError,
    refetch,
  };
};
