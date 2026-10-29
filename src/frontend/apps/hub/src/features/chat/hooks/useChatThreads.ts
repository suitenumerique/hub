import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { sameChatRef } from "@/features/chat/chatRefs";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef, ChatThread } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export type UseChatThreadsResult = {
  threads: ChatThread[];
  /** Threads with at least one unread reply, in the same order as `threads`. */
  unreadThreads: ChatThread[];
  /** Older threads remain to load with `fetchMore`. */
  hasMore: boolean;
  isFetchingMore: boolean;
  /** The last request for older threads failed (cleared by the next one). */
  isFetchMoreError: boolean;
  isInitialLoading: boolean;
  isError: boolean;
  refetch: () => void;
  /** Loads older threads; also retries a failed request. */
  fetchMore: () => void;
};

const EMPTY: ChatThread[] = [];

/**
 * Loads the threads of a conversation through the driver, for the threads
 * panel: the latest page first, as Element's thread panel, then older pages
 * through `fetchMore`. The query is keyed by `chatId`, so the threads stay
 * scoped to the active conversation; the unread banner reads
 * {@link useChatUnreadThreads}.
 */
export const useChatThreads = (ref: ChatRef): UseChatThreadsResult => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: chatKeys.threads(ref),
    queryFn: () => getRegistry().get(ref.accountId).getChatThreads(ref.chatId),
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });
  const hasMoreQuery = useQuery({
    queryKey: chatKeys.threadsHasMore(ref),
    queryFn: () =>
      getRegistry().get(ref.accountId).hasMoreChatThreads(ref.chatId),
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });
  const {
    mutate: loadMore,
    isPending,
    isError: loadFailed,
    variables: loadingRef,
  } = useMutation({
    mutationFn: (target: ChatRef) =>
      getRegistry().get(target.accountId).loadMoreChatThreads(target.chatId),
    // Pending until the new page is listed: the thread list prefix also
    // refreshes `hasMore`.
    onSuccess: (_result, target) =>
      queryClient.invalidateQueries({ queryKey: chatKeys.threads(target) }),
    // The list shows the failure, with its Retry.
    meta: { noGlobalError: true },
  });
  // A load still running or failed for another conversation is not this
  // list's.
  const isThisListLoad = sameChatRef(loadingRef, ref);
  const isFetchingMore = isPending && isThisListLoad;
  const isFetchMoreError = loadFailed && isThisListLoad;

  const refetch = useCallback(() => {
    void query.refetch();
    void hasMoreQuery.refetch();
  }, [query, hasMoreQuery]);

  const hasMore = hasMoreQuery.data ?? false;
  // Only a known end stops it: the list can reach its end before `hasMore`
  // loads, and a driver with nothing more to load makes no request.
  const isAtEnd = hasMoreQuery.data === false;
  // Virtuoso reports the end once per length, which can show before the load
  // that brought it ends: ask again once that load is done.
  const wantsMore = useRef(false);
  const fetchMore = useCallback(() => {
    if (isAtEnd) {
      return;
    }
    if (isFetchingMore) {
      wantsMore.current = true;
      return;
    }
    loadMore(ref);
  }, [isAtEnd, isFetchingMore, loadMore, ref]);
  useEffect(() => {
    wantsMore.current = false;
  }, [ref.accountId, ref.chatId]);
  useEffect(() => {
    if (isFetchingMore || !wantsMore.current) {
      return;
    }
    wantsMore.current = false;
    if (!isFetchMoreError) {
      fetchMore();
    }
  }, [fetchMore, isFetchingMore, isFetchMoreError]);

  const threads = query.data ?? EMPTY;

  const unreadThreads = useMemo(
    () => threads.filter((thread) => thread.unreadCount > 0),
    [threads],
  );

  return {
    threads,
    unreadThreads,
    hasMore,
    isFetchingMore,
    isFetchMoreError,
    isInitialLoading: query.isPending,
    isError: query.isError,
    refetch,
    fetchMore,
  };
};
