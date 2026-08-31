import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageWindow,
  ChatRef,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export const CHAT_PAGE_SIZE = 50;

const VIRTUOSO_INDEX_ANCHOR = 1_000_000;

type ChatPageParam = {
  cursor: string | null;
  direction: "initial" | "older" | "newer";
};

type CompatibleMessageWindow = ChatMessageWindow & {
  /** Compatibility with pages cached before bidirectional windows existed. */
  nextCursor?: string | null;
};

type FirstItemIndexState = {
  chatKey: string | null;
  initialPageSizeBaseline: number | null;
};

type UseChatMessagesOptions = {
  anchor: "first-unread" | "latest";
  enabled?: boolean;
};

export type UseChatMessagesResult = {
  messages: ChatMessage[];
  authorsById: Map<string, ChatMessageAuthor>;
  firstUnreadMessageId: string | null;
  anchorStatus: ChatMessageWindow["anchorStatus"] | null;
  unreadAnchorStatus: ChatMessageWindow["anchorStatus"] | null;
  hasOlder: boolean;
  hasNewer: boolean;
  isFetchingOlder: boolean;
  isFetchingNewer: boolean;
  isInitialLoading: boolean;
  isError: boolean;
  /** First virtual item index for Virtuoso. See `VIRTUOSO_INDEX_ANCHOR`. */
  firstItemIndex: number;
  fetchOlder: () => void;
  fetchNewer: () => void;
  openFirstUnread: () => Promise<boolean>;
};

type ChatMessagesData = InfiniteData<CompatibleMessageWindow, ChatPageParam>;

const INITIAL_PAGE_PARAM: ChatPageParam = {
  cursor: null,
  direction: "initial",
};

const pageDirection = (
  param: unknown,
  index: number,
): ChatPageParam["direction"] => {
  if (
    param &&
    typeof param === "object" &&
    "direction" in param &&
    (param.direction === "initial" ||
      param.direction === "older" ||
      param.direction === "newer")
  ) {
    return param.direction;
  }
  return index === 0 ? "initial" : "older";
};

export const useChatMessages = (
  ref: ChatRef,
  options?: UseChatMessagesOptions,
): UseChatMessagesResult => {
  const anchor = options?.anchor ?? "latest";
  const enabled = options?.enabled ?? true;
  const useBidirectionalWindow = options !== undefined;
  const queryClient = useQueryClient();
  const firstItemIndexState = useRef<FirstItemIndexState>({
    chatKey: null,
    initialPageSizeBaseline: null,
  });

  const query = useInfiniteQuery({
    queryKey: chatKeys.messages(ref),
    queryFn: async ({ pageParam }): Promise<CompatibleMessageWindow> => {
      const request = {
        chatId: ref.chatId,
        cursor: pageParam.cursor,
        limit: CHAT_PAGE_SIZE,
        ...(useBidirectionalWindow
          ? {
              anchor: pageParam.direction === "initial" ? anchor : undefined,
              direction:
                pageParam.direction === "initial"
                  ? undefined
                  : pageParam.direction,
            }
          : {}),
      };
      return getRegistry().get(ref.accountId).getChatMessages(request);
    },
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) => {
      const cursor = lastPage.olderCursor ?? lastPage.nextCursor;
      return cursor ? { cursor, direction: "older" as const } : undefined;
    },
    getPreviousPageParam: (firstPage) =>
      firstPage.newerCursor
        ? {
            cursor: firstPage.newerCursor,
            direction: "newer" as const,
          }
        : undefined,
    enabled,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  const unreadAnchorQuery = useQuery({
    queryKey: chatKeys.unreadAnchor(ref),
    queryFn: () =>
      getRegistry().get(ref.accountId).getChatMessages({
        chatId: ref.chatId,
        cursor: null,
        limit: CHAT_PAGE_SIZE,
        anchor: "first-unread",
      }),
    // Resolve `/context` only after the user activates the unread button.
    enabled: false,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });
  const unreadAnchorWindow = unreadAnchorQuery.data;
  const refetchUnreadAnchor = unreadAnchorQuery.refetch;

  // A conversation is opened as a fresh navigation window. Dropping its
  // inactive cache on leave ensures a later unread opening resolves the then
  // current Matrix marker instead of reusing an older "latest" window.
  useEffect(
    () => () => {
      queryClient.removeQueries({
        queryKey: chatKeys.messages(ref),
        exact: true,
      });
      queryClient.removeQueries({
        queryKey: chatKeys.unreadAnchor(ref),
        exact: true,
      });
    },
    [queryClient, ref.accountId, ref.chatId],
  );

  const messages = useMemo(() => {
    if (!query.data) {
      return [];
    }
    const seen = new Set<string>();
    return [...query.data.pages]
      .reverse()
      .flatMap((page) => page.messages)
      .filter((message) => {
        if (seen.has(message.id)) {
          return false;
        }
        seen.add(message.id);
        return true;
      });
  }, [query.data]);

  const authorsById = useMemo(() => {
    const map = new Map<string, ChatMessageAuthor>();
    query.data?.pages.forEach((page) => {
      page.authors.forEach((author) => map.set(author.id, author));
    });
    return map;
  }, [query.data]);

  const initialPage = useMemo(() => {
    const index = query.data?.pageParams.findIndex(
      (param, pageIndex) => pageDirection(param, pageIndex) === "initial",
    );
    return index === undefined || index < 0
      ? undefined
      : query.data?.pages[index];
  }, [query.data]);

  const fetchOlder = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  const fetchNewer = useCallback(() => {
    if (query.hasPreviousPage && !query.isFetchingPreviousPage) {
      void query.fetchPreviousPage();
    }
  }, [query]);

  const openFirstUnread = useCallback(async (): Promise<boolean> => {
    // The read boundary can advance while this conversation stays mounted.
    // Resolve it again on every activation instead of reopening a stale
    // contextual window from the previous jump.
    const anchorResult = await refetchUnreadAnchor();
    const resolved = anchorResult.isSuccess ? anchorResult.data : undefined;
    if (
      !resolved ||
      resolved.anchorStatus !== "resolved" ||
      !resolved.firstUnreadMessageId
    ) {
      return false;
    }

    firstItemIndexState.current.initialPageSizeBaseline = null;
    queryClient.setQueryData<ChatMessagesData>(
      chatKeys.messages({
        accountId: ref.accountId,
        chatId: ref.chatId,
      }),
      {
        pages: [resolved],
        pageParams: [INITIAL_PAGE_PARAM],
      },
    );
    return true;
  }, [queryClient, ref.accountId, ref.chatId, refetchUnreadAnchor]);

  const firstItemIndex = useMemo(() => {
    const chatKey = `${ref.accountId}:${ref.chatId}`;
    const state = firstItemIndexState.current;
    if (state.chatKey !== chatKey) {
      state.chatKey = chatKey;
      state.initialPageSizeBaseline = null;
    }

    const pages = query.data?.pages ?? [];
    const pageParams = query.data?.pageParams ?? [];
    const initialIndex = pageParams.findIndex(
      (param, index) => pageDirection(param, index) === "initial",
    );
    const initialPageSize = pages[initialIndex]?.messages.length;
    if (initialPageSize === undefined) {
      return VIRTUOSO_INDEX_ANCHOR;
    }

    if (
      state.initialPageSizeBaseline === null ||
      initialPageSize < state.initialPageSizeBaseline
    ) {
      state.initialPageSizeBaseline = initialPageSize;
    }

    const olderMessagesCount = pages.reduce(
      (total, page, index) =>
        pageDirection(pageParams[index], index) === "older"
          ? total + page.messages.length
          : total,
      0,
    );
    return (
      VIRTUOSO_INDEX_ANCHOR - state.initialPageSizeBaseline - olderMessagesCount
    );
  }, [query.data?.pageParams, query.data?.pages, ref.accountId, ref.chatId]);

  return {
    messages,
    authorsById,
    firstUnreadMessageId: initialPage?.firstUnreadMessageId ?? null,
    anchorStatus: initialPage?.anchorStatus ?? null,
    unreadAnchorStatus: unreadAnchorWindow?.anchorStatus ?? null,
    hasOlder: Boolean(query.hasNextPage),
    hasNewer: Boolean(query.hasPreviousPage),
    isFetchingOlder: query.isFetchingNextPage,
    isFetchingNewer: query.isFetchingPreviousPage,
    isInitialLoading: !enabled || query.isPending,
    isError: query.isError,
    firstItemIndex,
    fetchOlder,
    fetchNewer,
    openFirstUnread,
  };
};
