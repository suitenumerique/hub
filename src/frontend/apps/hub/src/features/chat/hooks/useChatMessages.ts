import {
  type InfiniteData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessagesPage,
  ChatRef,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export const CHAT_PAGE_SIZE = 100;
const VIRTUOSO_INDEX_ANCHOR = 1_000_000;

type MessagePageParam = {
  cursor: string | null;
  direction: "older" | "newer";
  anchorId?: string;
};

type FirstItemIndexState = {
  chatKey: string | null;
  windowVersion: number;
  firstMessageId: string | null;
  firstItemIndex: number;
};

export type UseChatMessagesResult = {
  messages: ChatMessage[];
  authorsById: Map<string, ChatMessageAuthor>;
  hasOlder: boolean;
  hasNewer: boolean;
  isAtLiveEnd: boolean;
  isFetchingOlder: boolean;
  isFetchingNewer: boolean;
  isInitialLoading: boolean;
  isError: boolean;
  firstItemIndex: number;
  windowVersion: number;
  windowAnchorId: string | null;
  fetchOlder: () => void;
  fetchNewer: () => void;
  openAround: (eventId: string) => Promise<void>;
};

export const useChatMessages = (ref: ChatRef): UseChatMessagesResult => {
  const queryClient = useQueryClient();
  const [windowVersion, setWindowVersion] = useState(0);
  const [windowAnchor, setWindowAnchor] = useState<{
    chatKey: string;
    eventId: string;
  } | null>(null);
  const firstItemIndexState = useRef<FirstItemIndexState>({
    chatKey: null,
    windowVersion: 0,
    firstMessageId: null,
    firstItemIndex: VIRTUOSO_INDEX_ANCHOR,
  });
  const queryKey = useMemo(
    () => chatKeys.messages(ref),
    [ref.accountId, ref.chatId],
  );
  const [isOpeningLive, setIsOpeningLive] = useState(
    () =>
      queryClient.getQueryData<InfiniteData<ChatMessagesPage>>(queryKey)
        ?.pages[0]?.isAtLiveEnd === false,
  );
  const contextRequestRef = useRef<symbol | null>(null);

  // A previous visit may have left a window around an unread message in cache.
  // Reset its pages and cursors before enabling the query so entry loads the
  // latest page. A cache that already reaches the live end remains reusable.
  useEffect(() => {
    if (isOpeningLive) {
      void queryClient.resetQueries({ queryKey, exact: true });
      setIsOpeningLive(false);
    }
  }, [isOpeningLive, queryClient, queryKey]);

  // A contextual load from a closed conversation must not overwrite its cache
  // after a later visit has already reopened the latest messages.
  useEffect(
    () => () => {
      contextRequestRef.current = null;
    },
    [],
  );

  const query = useInfiniteQuery({
    queryKey,
    enabled: !isOpeningLive,
    queryFn: ({ pageParam }) =>
      getRegistry().get(ref.accountId).getChatMessages({
        chatId: ref.chatId,
        cursor: pageParam.cursor,
        direction: pageParam.direction,
        anchorId: pageParam.anchorId,
        limit: CHAT_PAGE_SIZE,
      }),
    initialPageParam: {
      cursor: null,
      direction: "older",
    } as MessagePageParam,
    getNextPageParam: (lastPage): MessagePageParam | undefined =>
      lastPage.nextCursor
        ? { cursor: lastPage.nextCursor, direction: "older" }
        : undefined,
    getPreviousPageParam: (firstPage): MessagePageParam | undefined =>
      firstPage.newerCursor
        ? { cursor: firstPage.newerCursor, direction: "newer" }
        : undefined,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  // React Query keeps the live/newest page first and appends older pages after
  // it. Reverse that page order for display, then de-duplicate on Matrix event
  // identity because two adjacent contextual windows can overlap.
  const messages = useMemo(() => {
    if (isOpeningLive) {
      return [];
    }
    const seen = new Set<string>();
    return [...(query.data?.pages ?? [])]
      .reverse()
      .flatMap((page) => page.messages)
      .filter((message) => {
        if (seen.has(message.id)) {
          return false;
        }
        seen.add(message.id);
        return true;
      });
  }, [isOpeningLive, query.data]);

  const authorsById = useMemo(() => {
    const map = new Map<string, ChatMessageAuthor>();
    query.data?.pages.forEach((page) => {
      page.authors.forEach((author) => map.set(author.id, author));
    });
    return map;
  }, [query.data]);

  const fetchOlder = useCallback(() => {
    if (query.hasNextPage && !query.isFetching) {
      void query.fetchNextPage();
    }
  }, [query]);

  const fetchNewer = useCallback(() => {
    if (query.hasPreviousPage && !query.isFetching) {
      void query.fetchPreviousPage();
    }
  }, [query]);

  const openAround = useCallback(
    async (eventId: string) => {
      const request = Symbol();
      contextRequestRef.current = request;
      await queryClient.cancelQueries({ queryKey, exact: true });
      if (contextRequestRef.current !== request) {
        return;
      }
      const page = await getRegistry().get(ref.accountId).getChatMessages({
        chatId: ref.chatId,
        anchorId: eventId,
        direction: "older",
        limit: CHAT_PAGE_SIZE,
      });
      if (contextRequestRef.current !== request) {
        return;
      }
      contextRequestRef.current = null;
      queryClient.setQueryData<
        InfiniteData<ChatMessagesPage, MessagePageParam>
      >(queryKey, {
        pages: [page],
        pageParams: [{ cursor: null, direction: "older", anchorId: eventId }],
      });
      setWindowAnchor({
        chatKey: `${ref.accountId}:${ref.chatId}`,
        eventId,
      });
      setWindowVersion((version) => version + 1);
    },
    [queryClient, queryKey, ref.accountId, ref.chatId],
  );

  // Virtuoso indexes are derived from Matrix identities. When older messages
  // are prepended, find the former first event and move the virtual origin by
  // exactly that many rows. Appends and counter updates leave it untouched.
  const firstItemIndex = useMemo(() => {
    const chatKey = `${ref.accountId}:${ref.chatId}`;
    const state = firstItemIndexState.current;
    const firstMessageId = messages[0]?.id ?? null;
    if (state.chatKey !== chatKey || state.windowVersion !== windowVersion) {
      state.chatKey = chatKey;
      state.windowVersion = windowVersion;
      state.firstMessageId = firstMessageId;
      state.firstItemIndex = VIRTUOSO_INDEX_ANCHOR - messages.length;
      return state.firstItemIndex;
    }

    if (!state.firstMessageId && firstMessageId) {
      // A cold query first renders without data. Capture the real initial page
      // once it arrives so Virtuoso can offset every subsequent prepend.
      state.firstMessageId = firstMessageId;
      state.firstItemIndex = VIRTUOSO_INDEX_ANCHOR - messages.length;
      return state.firstItemIndex;
    }

    if (state.firstMessageId && firstMessageId !== state.firstMessageId) {
      const previousFirstIndex = messages.findIndex(
        (message) => message.id === state.firstMessageId,
      );
      if (previousFirstIndex >= 0) {
        state.firstItemIndex -= previousFirstIndex;
      } else {
        state.firstItemIndex = VIRTUOSO_INDEX_ANCHOR - messages.length;
      }
      state.firstMessageId = firstMessageId;
    }
    return state.firstItemIndex;
  }, [messages, ref.accountId, ref.chatId, windowVersion]);

  return {
    messages,
    authorsById,
    hasOlder: Boolean(query.hasNextPage),
    hasNewer: Boolean(query.hasPreviousPage),
    isAtLiveEnd: query.data?.pages[0]?.isAtLiveEnd === true,
    isFetchingOlder: query.isFetchingNextPage,
    isFetchingNewer: query.isFetchingPreviousPage,
    isInitialLoading: isOpeningLive || query.isPending,
    isError: query.isError,
    firstItemIndex,
    windowVersion,
    windowAnchorId:
      windowAnchor?.chatKey === `${ref.accountId}:${ref.chatId}`
        ? windowAnchor.eventId
        : null,
    fetchOlder,
    fetchNewer,
    openAround,
  };
};
