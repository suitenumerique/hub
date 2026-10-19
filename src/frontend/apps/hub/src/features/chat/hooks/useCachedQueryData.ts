import { hashKey, type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Data a query already holds, kept in sync without ever fetching it.
 *
 * Use this instead of a `useQuery` with `skipToken` to read a query owned by
 * another hook: every `useQuery` render replaces the query's options with its
 * own, so a `skipToken` observer on an infinite query (the timeline) leaves it
 * without a query function and its next invalidation fails.
 */
export const useCachedQueryData = <T>(queryKey: QueryKey): T | undefined => {
  const queryClient = useQueryClient();
  const queryHash = hashKey(queryKey);
  const subscribe = useCallback(
    (onChange: () => void) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryHash === queryHash) {
          onChange();
        }
      }),
    [queryClient, queryHash],
  );
  const getSnapshot = () => queryClient.getQueryData<T>(queryKey);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
