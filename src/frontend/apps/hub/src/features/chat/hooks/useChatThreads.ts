import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef, ChatThread } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export type UseChatThreadsResult = {
  threads: ChatThread[];
  /** Threads with at least one unread reply, in the same order as `threads`. */
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
  const query = useQuery({
    queryKey: chatKeys.threads(ref),
    queryFn: () => getRegistry().get(ref.accountId).getChatThreads(ref.chatId),
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  const threads = query.data ?? EMPTY;

  const unreadThreads = useMemo(
    () => threads.filter((thread) => thread.unreadCount > 0),
    [threads],
  );

  return {
    threads,
    unreadThreads,
    isInitialLoading: query.isPending,
    isError: query.isError,
    refetch,
  };
};
