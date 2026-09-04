import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { chatKeys } from "@/features/chat/chatKeys";
import { decorateChat } from "@/features/chat/chatRefs";
import {
  compareChatSearchText,
  normalizeChatSearchText,
} from "@/features/chat/chatSearchMatching";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { ChatSearchIndexStatus } from "@/features/drivers/Driver";
import type { ChatSearchResult } from "@/features/drivers/types";

const SEARCH_DEBOUNCE_MS = 300;

export type UseChatSearchResult = {
  conversations: ChatSearchResult[];
  normalizedQuery: string;
  isLoading: boolean;
  isIndexing: boolean;
  isError: boolean;
  indexStatus: ChatSearchIndexStatus;
};

const EMPTY_INDEX_STATUS: ChatSearchIndexStatus = {
  phase: "ready",
  indexedRooms: 0,
  totalRooms: 0,
  failedRooms: 0,
};

const INDEX_PHASE_PRIORITY: Record<ChatSearchIndexStatus["phase"], number> = {
  ready: 0,
  "catching-up": 1,
  indexing: 2,
  loading: 3,
  error: 4,
};

const useDebouncedQuery = (query: string): string => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    if (!query) {
      setDebouncedQuery("");
      return;
    }
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [query]);

  return debouncedQuery;
};

/** Search the active scope's existing conversations. */
export const useChatSearch = (query: string): UseChatSearchResult => {
  const entries = useDriverEntries();
  const normalizedQuery = normalizeChatSearchText(query);
  const debouncedQuery = useDebouncedQuery(normalizedQuery);
  const isDebouncing = normalizedQuery !== debouncedQuery;

  const conversationQueries = useQueries({
    queries: entries.map((entry) => ({
      queryKey: chatKeys.search(entry.accountId, debouncedQuery),
      queryFn: () => entry.driver.searchChats({ q: debouncedQuery }),
      enabled: debouncedQuery.length > 0,
      staleTime: 30_000,
      meta: { noGlobalError: true },
    })),
  });
  const indexStatusQueries = useQueries({
    queries: entries.map((entry) => ({
      queryKey: chatKeys.searchIndexStatus(entry.accountId),
      queryFn: () => entry.driver.getChatSearchIndexStatus(),
      staleTime: Infinity,
      meta: { noGlobalError: true },
    })),
  });
  const indexStatus = useMemo<ChatSearchIndexStatus>(() => {
    if (entries.length === 0) {
      return EMPTY_INDEX_STATUS;
    }
    return indexStatusQueries.reduce<ChatSearchIndexStatus>(
      (aggregate, query) => {
        const accountStatus =
          query.data ??
          (query.isError
            ? { ...EMPTY_INDEX_STATUS, phase: "error" as const }
            : { ...EMPTY_INDEX_STATUS, phase: "loading" as const });
        return {
          phase:
            INDEX_PHASE_PRIORITY[accountStatus.phase] >
            INDEX_PHASE_PRIORITY[aggregate.phase]
              ? accountStatus.phase
              : aggregate.phase,
          indexedRooms: aggregate.indexedRooms + accountStatus.indexedRooms,
          totalRooms: aggregate.totalRooms + accountStatus.totalRooms,
          failedRooms: aggregate.failedRooms + accountStatus.failedRooms,
        };
      },
      { ...EMPTY_INDEX_STATUS },
    );
  }, [entries.length, indexStatusQueries]);
  const conversations = useMemo(() => {
    if (isDebouncing || !debouncedQuery) {
      return [];
    }
    const unique = new Map<string, ChatSearchResult>();
    entries.forEach((entry, index) => {
      conversationQueries[index]?.data?.forEach((result) => {
        const chat = decorateChat(entry.accountId, result.chat);
        unique.set(`${entry.accountId}:${chat.id}`, { ...result, chat });
      });
    });
    return [...unique.values()].sort(
      (left, right) =>
        left.matchRank - right.matchRank ||
        compareChatSearchText(left.chat.name, right.chat.name) ||
        left.chat.accountId.localeCompare(right.chat.accountId) ||
        left.chat.id.localeCompare(right.chat.id),
    );
  }, [conversationQueries, debouncedQuery, entries, isDebouncing]);

  const hasPendingConversation = conversationQueries.some(
    (result) => result.isPending,
  );
  return {
    conversations,
    normalizedQuery,
    indexStatus,
    isIndexing:
      indexStatus.phase === "loading" ||
      indexStatus.phase === "indexing" ||
      indexStatus.phase === "catching-up",
    isLoading:
      normalizedQuery.length > 0 && (isDebouncing || hasPendingConversation),
    isError: conversationQueries.some((result) => result.isError),
  };
};
