import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatRef,
  ChatMessage,
  ChatMessageAuthor,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export const CHAT_PAGE_SIZE = 50;

// Virtuoso uses a virtual index space. We start from a high anchor so that
// prepending older messages stays in positive territory; `firstItemIndex` is
// the anchor minus the number of currently loaded messages, and Virtuoso uses
// it to keep the visible scroll position stable across prepends.
const VIRTUOSO_INDEX_ANCHOR = 1_000_000;

export type UseChatMessagesResult = {
  messages: ChatMessage[];
  authorsById: Map<string, ChatMessageAuthor>;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  isInitialLoading: boolean;
  isError: boolean;
  /** First virtual item index for Virtuoso. See `VIRTUOSO_INDEX_ANCHOR`. */
  firstItemIndex: number;
  fetchOlder: () => void;
};

export const useChatMessages = (ref: ChatRef): UseChatMessagesResult => {
  const query = useInfiniteQuery({
    queryKey: chatKeys.messages(ref),
    queryFn: ({ pageParam }) =>
      getRegistry().get(ref.accountId).getChatMessages({
        chatId: ref.chatId,
        cursor: pageParam,
        limit: CHAT_PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  const messages = useMemo(() => {
    if (!query.data) {
      return [];
    }
    // pages are ordered [newest-fetch-first, ..., oldest-fetch-last]; each page
    // already holds messages in chronological ASC order. Older pages must come
    // first in the flat array, so iterate pages in reverse.
    return [...query.data.pages].reverse().flatMap((page) => page.messages);
  }, [query.data]);

  const authorsById = useMemo(() => {
    const map = new Map<string, ChatMessageAuthor>();
    query.data?.pages.forEach((page) => {
      page.authors.forEach((author) => map.set(author.id, author));
    });
    return map;
  }, [query.data]);

  const fetchOlder = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  return {
    messages,
    authorsById,
    hasOlder: Boolean(query.hasNextPage),
    isFetchingOlder: query.isFetchingNextPage,
    isInitialLoading: query.isPending,
    isError: query.isError,
    firstItemIndex: VIRTUOSO_INDEX_ANCHOR - messages.length,
    fetchOlder,
  };
};
