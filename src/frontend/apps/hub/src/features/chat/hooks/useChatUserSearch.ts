import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getDriver } from "@/features/config/Config";
import type { ChatUser } from "@/features/drivers/types";

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
  const driver = getDriver();
  const normalizedQuery = normalizeChatUserQuery(query);
  const excludedKey = useMemo(() => [...excludeIds].sort(), [excludeIds]);

  const search = useQuery({
    queryKey: ["chat-user-search", normalizedQuery, excludedKey],
    queryFn: () =>
      driver.getChatUsers({
        q: normalizedQuery,
        excludeIds: excludedKey,
      }),
    enabled: normalizedQuery.length > 0,
    staleTime: 30_000,
    meta: { noGlobalError: true },
  });

  return {
    users: search.data ?? [],
    isInitialLoading: search.isPending && normalizedQuery.length > 0,
    isError: search.isError,
  };
};
