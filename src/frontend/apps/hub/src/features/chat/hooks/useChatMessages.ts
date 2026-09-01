import {
  type InfiniteData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { GetChatMessagesParams } from "@/features/drivers/Driver";
import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessageWindow,
  ChatRef,
  ChatUnread,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export const CHAT_PAGE_SIZE = 50;

const VIRTUOSO_INDEX_ANCHOR = 1_000_000;

type ChatPageParam =
  | { direction: "initial" }
  | { cursor: string; direction: "older" | "newer" };

type FirstItemIndexState = {
  chatKey: string | null;
  windowVersion: number;
  initialPageSizeBaseline: number | null;
};

type UseChatMessagesOptions = {
  enabled?: boolean;
  readBoundaryId?: string | null;
};

export type OpenFirstUnreadResult =
  | { status: "opened"; firstUnreadMessageId: string }
  | { status: "none" }
  | { status: "unavailable" }
  | { status: "error"; error: unknown };

export type UseChatMessagesResult = {
  messages: ChatMessage[];
  authorsById: Map<string, ChatMessageAuthor>;
  readBoundaryId: string | null;
  firstUnreadMessageId: string | null;
  anchorStatus: ChatMessageWindow["anchorStatus"] | null;
  hasOlder: boolean;
  hasNewer: boolean;
  isFetchingOlder: boolean;
  isFetchingNewer: boolean;
  isInitialLoading: boolean;
  isError: boolean;
  firstItemIndex: number;
  fetchOlder: () => void;
  fetchNewer: () => void;
  openFirstUnread: () => Promise<OpenFirstUnreadResult>;
};

type ChatMessagesData = InfiniteData<ChatMessageWindow, ChatPageParam>;

const INITIAL_PAGE_PARAM: ChatPageParam = { direction: "initial" };

const toMessageWindowRequest = (
  chatId: string,
  pageParam: ChatPageParam,
): GetChatMessagesParams =>
  pageParam.direction === "initial"
    ? { chatId, limit: CHAT_PAGE_SIZE, anchor: "latest" }
    : {
        chatId,
        limit: CHAT_PAGE_SIZE,
        cursor: pageParam.cursor,
        direction: pageParam.direction,
      };

const chronologicalMessages = (data: ChatMessagesData): ChatMessage[] => {
  const seen = new Set<string>();
  return [...data.pages]
    .reverse()
    .flatMap((page) => page.messages)
    .filter((message) => {
      if (seen.has(message.id)) {
        return false;
      }
      seen.add(message.id);
      return true;
    });
};

export const useChatMessages = (
  ref: ChatRef,
  options?: UseChatMessagesOptions,
): UseChatMessagesResult => {
  const chatKey = `${ref.accountId}:${ref.chatId}`;
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const openingRequestId = useRef(0);
  const paginationRequest = useRef<Promise<unknown> | null>(null);
  const windowVersion = useRef(0);
  const firstItemIndexState = useRef<FirstItemIndexState>({
    chatKey: null,
    windowVersion: -1,
    initialPageSizeBaseline: null,
  });

  const query = useInfiniteQuery<
    ChatMessageWindow,
    Error,
    ChatMessagesData,
    ReturnType<typeof chatKeys.messages>,
    ChatPageParam
  >({
    queryKey: chatKeys.messages(ref),
    queryFn: ({ pageParam }) =>
      getRegistry()
        .get(ref.accountId)
        .getChatMessages(toMessageWindowRequest(ref.chatId, pageParam)),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) =>
      lastPage.olderCursor
        ? { cursor: lastPage.olderCursor, direction: "older" as const }
        : undefined,
    getPreviousPageParam: (firstPage) =>
      firstPage.newerCursor
        ? { cursor: firstPage.newerCursor, direction: "newer" as const }
        : undefined,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    meta: { noGlobalError: true },
  });

  useEffect(
    () => () => {
      openingRequestId.current += 1;
      queryClient.removeQueries({
        queryKey: chatKeys.messages(ref),
        exact: true,
      });
    },
    [queryClient, ref.accountId, ref.chatId],
  );

  const data = query.data;
  const messages = useMemo(
    () => (data ? chronologicalMessages(data) : []),
    [data],
  );
  const authorsById = useMemo(() => {
    const authors = new Map<string, ChatMessageAuthor>();
    data?.pages.forEach((page) => {
      page.authors.forEach((author) => authors.set(author.id, author));
    });
    return authors;
  }, [data]);
  const initialPageIndex =
    data?.pageParams.findIndex((param) => param.direction === "initial") ?? -1;
  const initialPage =
    initialPageIndex >= 0 ? data?.pages[initialPageIndex] : undefined;
  const resolvedFirstUnreadMessageId = useMemo(() => {
    const currentBoundaryId = options?.readBoundaryId;
    const windowTarget =
      data?.pages.find(
        (page) =>
          page.firstUnreadMessageId &&
          (!currentBoundaryId || page.readBoundaryId === currentBoundaryId),
      )?.firstUnreadMessageId ?? null;
    if (!currentBoundaryId) {
      return windowTarget;
    }
    const boundaryIndex = messages.findIndex(
      (message) => message.id === currentBoundaryId,
    );
    if (boundaryIndex < 0) {
      // Matrix's persistent boundary need not itself be a rendered bubble.
      return windowTarget;
    }
    return (
      messages
        .slice(boundaryIndex + 1)
        .find((message) => message.authorId !== "me" && !message.isDeleted)
        ?.id ?? null
    );
  }, [data?.pages, messages, options?.readBoundaryId]);

  const trackPagination = useCallback((request: Promise<unknown>) => {
    paginationRequest.current = request;
    const release = () => {
      if (paginationRequest.current === request) {
        paginationRequest.current = null;
      }
    };
    void request.then(release, release);
  }, []);

  const fetchOlder = useCallback(() => {
    if (
      !query.hasNextPage ||
      query.isFetchingNextPage ||
      query.isFetchingPreviousPage ||
      paginationRequest.current
    ) {
      return;
    }
    trackPagination(query.fetchNextPage({ cancelRefetch: false }));
  }, [query, trackPagination]);

  const fetchNewer = useCallback(() => {
    if (
      !query.hasPreviousPage ||
      query.isFetchingPreviousPage ||
      query.isFetchingNextPage ||
      paginationRequest.current
    ) {
      return;
    }
    trackPagination(query.fetchPreviousPage({ cancelRefetch: false }));
  }, [query, trackPagination]);

  const openFirstUnread =
    useCallback(async (): Promise<OpenFirstUnreadResult> => {
      const requestId = openingRequestId.current + 1;
      openingRequestId.current = requestId;
      await queryClient.cancelQueries({
        queryKey: chatKeys.messages(ref),
        exact: true,
      });

      try {
        let window: ChatMessageWindow | null = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const boundaryAtStart = queryClient.getQueryData<
            Record<string, ChatUnread>
          >(chatKeys.unreadOf(ref.accountId))?.[ref.chatId]
            ?.mainTimelineReadBoundaryId;
          const resolved = await getRegistry()
            .get(ref.accountId)
            .getChatMessages({
              chatId: ref.chatId,
              limit: CHAT_PAGE_SIZE,
              anchor: "first-unread",
            });
          const boundaryNow = queryClient.getQueryData<
            Record<string, ChatUnread>
          >(chatKeys.unreadOf(ref.accountId))?.[ref.chatId]
            ?.mainTimelineReadBoundaryId;
          if (boundaryNow === boundaryAtStart) {
            window = resolved;
            break;
          }
        }
        if (openingRequestId.current !== requestId) {
          return {
            status: "error",
            error: new Error("Unread navigation was superseded."),
          };
        }
        if (!window) {
          return { status: "unavailable" };
        }
        if (window.anchorStatus === "none") {
          return { status: "none" };
        }
        if (window.anchorStatus === "unavailable") {
          return { status: "unavailable" };
        }
        const firstUnreadId = window.firstUnreadMessageId;
        if (!firstUnreadId) {
          return { status: "none" };
        }

        windowVersion.current += 1;
        queryClient.setQueryData<ChatMessagesData>(chatKeys.messages(ref), {
          pages: [window],
          pageParams: [INITIAL_PAGE_PARAM],
        });
        queryClient.setQueryData<Record<string, ChatUnread>>(
          chatKeys.unreadOf(ref.accountId),
          (current) =>
            current?.[ref.chatId]
              ? {
                  ...current,
                  [ref.chatId]: {
                    ...current[ref.chatId],
                    mainTimelineReadBoundaryId: window.readBoundaryId,
                  },
                }
              : current,
        );
        return { status: "opened", firstUnreadMessageId: firstUnreadId };
      } catch (error) {
        return { status: "error", error };
      }
    }, [queryClient, ref.accountId, ref.chatId]);

  const firstItemIndex = useMemo(() => {
    const state = firstItemIndexState.current;
    if (
      state.chatKey !== chatKey ||
      state.windowVersion !== windowVersion.current
    ) {
      state.chatKey = chatKey;
      state.windowVersion = windowVersion.current;
      state.initialPageSizeBaseline = null;
    }

    const pages = data?.pages ?? [];
    const pageParams = data?.pageParams ?? [];
    const initialIndex = pageParams.findIndex(
      (param) => param.direction === "initial",
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
        pageParams[index]?.direction === "older"
          ? total + page.messages.length
          : total,
      0,
    );
    return (
      VIRTUOSO_INDEX_ANCHOR - state.initialPageSizeBaseline - olderMessagesCount
    );
  }, [chatKey, data?.pageParams, data?.pages]);

  return {
    messages,
    authorsById,
    readBoundaryId: initialPage?.readBoundaryId ?? null,
    firstUnreadMessageId: resolvedFirstUnreadMessageId,
    anchorStatus: initialPage?.anchorStatus ?? null,
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
