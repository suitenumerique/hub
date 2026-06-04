import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatUser } from "@/features/drivers/types";

import { useComposerAccountId } from "./useChatAccounts";

export type UseChatUserSearchResult = {
  users: ChatUser[];
  isInitialLoading: boolean;
  isError: boolean;
};

export const normalizeChatUserQuery = (query: string) => query.trim();

export const useChatUserSearch = (
  query: string,
  excludeIds: string[],
): UseChatUserSearchResult => {
  const accountId = useComposerAccountId();
  const normalizedQuery = normalizeChatUserQuery(query);
  const excludedKey = useMemo(() => [...excludeIds].sort(), [excludeIds]);

  const search = useQuery({
    queryKey: ["chat-user-search", accountId, normalizedQuery, excludedKey],
    queryFn: () => {
      if (!accountId) {
        return [];
      }
      return getRegistry().get(accountId).getChatUsers({
        q: normalizedQuery,
        excludeIds: excludedKey,
      });
    },
    enabled: normalizedQuery.length > 0 && accountId !== null,
    staleTime: 30_000,
    meta: { noGlobalError: true },
  });

  return {
    users: search.data ?? [],
    isInitialLoading: search.isPending && normalizedQuery.length > 0,
    isError: search.isError,
  };
};
