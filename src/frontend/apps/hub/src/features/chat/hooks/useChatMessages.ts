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
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export const CHAT_PAGE_SIZE = 50;

const VIRTUOSO_INDEX_ANCHOR = 1_000_000;

type ChatPageParam =
  | { direction: "initial" }
  | { cursor: string; direction: "older" | "newer" };

type FirstItemIndexState = {
  chatKey: string | null;
  window: "live" | "unread" | null;
  initialPageSizeBaseline: number | null;
};

type UseChatMessagesOptions = {
  enabled?: boolean;
};

export type OpenFirstUnreadResult =
  | { status: "opened" }
  | { status: "none" }
  | { status: "unavailable" }
  | { status: "error"; error: unknown };

export type UseChatMessagesResult = {
  messages: ChatMessage[];
  authorsById: Map<string, ChatMessageAuthor>;
  firstUnreadMessageId: string | null;
  anchorStatus: ChatMessageWindow["anchorStatus"] | null;
  /** Whether the temporary first-unread query currently owns the list data. */
  isUnreadWindowActive: boolean;
  /** Last message of the permanent live window, even while context is shown. */
  liveEndMessageId: string | null;
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
  openFirstUnread: () => Promise<OpenFirstUnreadResult>;
  /** Idempotently leaves the contextual window without touching live data. */
  closeUnreadContext: () => void;
};

type ChatMessagesData = InfiniteData<ChatMessageWindow, ChatPageParam>;

const INITIAL_PAGE_PARAM: ChatPageParam = {
  direction: "initial",
};

const toMessageWindowRequest = (
  chatId: string,
  pageParam: ChatPageParam,
  anchor: "first-unread" | "latest",
): GetChatMessagesParams => {
  if (pageParam.direction === "initial") {
    return { chatId, limit: CHAT_PAGE_SIZE, anchor };
  }
  return {
    chatId,
    limit: CHAT_PAGE_SIZE,
    cursor: pageParam.cursor,
    direction: pageParam.direction,
  };
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
  const firstItemIndexState = useRef<FirstItemIndexState>({
    chatKey: null,
    window: null,
    initialPageSizeBaseline: null,
  });
  const unreadRequestIdRef = useRef(0);
  const paginationRequestRef = useRef<Promise<unknown> | null>(null);

  // This cache always represents the true live end. Composition and global
  // `message:new` events rely on page 0 being the newest loaded page.
  const liveQuery = useInfiniteQuery<
    ChatMessageWindow,
    Error,
    ChatMessagesData,
    ReturnType<typeof chatKeys.messages>,
    ChatPageParam
  >({
    queryKey: chatKeys.messages(ref),
    queryFn: async ({ pageParam }): Promise<ChatMessageWindow> => {
      const request = toMessageWindowRequest(ref.chatId, pageParam, "latest");
      return getRegistry().get(ref.accountId).getChatMessages(request);
    },
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) => {
      const cursor = lastPage.olderCursor;
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
    gcTime: Infinity,
    meta: { noGlobalError: true },
  });

  // The unread window is intentionally a different cache. It can have newer
  // pages still missing, so installing it into `chatKeys.messages` would break
  // the live cache's page-0 invariant and optimistic composition ordering.
  const unreadQuery = useInfiniteQuery<
    ChatMessageWindow,
    Error,
    ChatMessagesData,
    ReturnType<typeof chatKeys.unreadMessages>,
    ChatPageParam
  >({
    queryKey: chatKeys.unreadMessages(ref),
    queryFn: async ({ pageParam }): Promise<ChatMessageWindow> =>
      getRegistry()
        .get(ref.accountId)
        .getChatMessages(
          toMessageWindowRequest(ref.chatId, pageParam, "first-unread"),
        ),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: (lastPage) => {
      const cursor = lastPage.olderCursor;
      return cursor ? { cursor, direction: "older" as const } : undefined;
    },
    getPreviousPageParam: (firstPage) =>
      firstPage.newerCursor
        ? {
            cursor: firstPage.newerCursor,
            direction: "newer" as const,
          }
        : undefined,
    // `openFirstUnread` explicitly refetches this disabled query. Keeping the
    // request in React Query lets cache resets cancel an in-flight opening.
    enabled: false,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });
  const refetchUnread = unreadQuery.refetch;

  // A later visit must resolve both the current live end and the current read
  // boundary. Keeping either window would preserve stale unread metadata.
  useEffect(
    () => () => {
      unreadRequestIdRef.current += 1;
      queryClient.removeQueries({
        queryKey: chatKeys.messages(ref),
        exact: true,
      });
      queryClient.removeQueries({
        queryKey: chatKeys.unreadMessages(ref),
        exact: true,
      });
    },
    [queryClient, ref.accountId, ref.chatId],
  );

  const isUnreadWindowActive = unreadQuery.data !== undefined;
  const activeWindow = isUnreadWindowActive ? "unread" : "live";
  const activeData = isUnreadWindowActive ? unreadQuery.data : liveQuery.data;
  const hasOlder = Boolean(
    isUnreadWindowActive ? unreadQuery.hasNextPage : liveQuery.hasNextPage,
  );
  const hasNewer = Boolean(
    isUnreadWindowActive
      ? unreadQuery.hasPreviousPage
      : liveQuery.hasPreviousPage,
  );
  const isFetchingOlder = isUnreadWindowActive
    ? unreadQuery.isFetchingNextPage
    : liveQuery.isFetchingNextPage;
  const isFetchingNewer = isUnreadWindowActive
    ? unreadQuery.isFetchingPreviousPage
    : liveQuery.isFetchingPreviousPage;
  const fetchOlderPage = isUnreadWindowActive
    ? unreadQuery.fetchNextPage
    : liveQuery.fetchNextPage;
  const fetchNewerPage = isUnreadWindowActive
    ? unreadQuery.fetchPreviousPage
    : liveQuery.fetchPreviousPage;

  const messages = useMemo(() => {
    if (!activeData) {
      return [];
    }
    return chronologicalMessages(activeData);
  }, [activeData]);

  const authorsById = useMemo(() => {
    const map = new Map<string, ChatMessageAuthor>();
    activeData?.pages.forEach((page) => {
      page.authors.forEach((author) => map.set(author.id, author));
    });
    return map;
  }, [activeData]);

  const initialPage = useMemo(() => {
    const index = activeData?.pageParams.findIndex(
      (param) => param.direction === "initial",
    );
    return index === undefined || index < 0
      ? undefined
      : activeData?.pages[index];
  }, [activeData]);
  const firstUnreadMessageId =
    initialPage?.firstUnreadMessageId ??
    activeData?.pages.find((page) => page.firstUnreadMessageId)
      ?.firstUnreadMessageId ??
    null;

  const resetUnreadContext = useCallback(
    () =>
      queryClient.resetQueries({
        queryKey: chatKeys.unreadMessages(ref),
        exact: true,
      }),
    [queryClient, ref.accountId, ref.chatId],
  );

  const closeUnreadContext = useCallback(() => {
    unreadRequestIdRef.current += 1;
    void resetUnreadContext();
  }, [resetUnreadContext]);

  /**
   * Live events can arrive while the last contextual page is loading. Until
   * that page removes its `newerCursor`, `useChatEvents` patches only the live
   * cache to avoid creating a gap. Once both windows overlap at the live end,
   * copy those trailing events into the contextual page.
   */
  const reconcileUnreadWithLiveEnd = useCallback((): boolean => {
    let isConnected = true;
    queryClient.setQueryData<ChatMessagesData>(
      chatKeys.unreadMessages(ref),
      (contextData) => {
        if (!contextData) {
          return contextData;
        }
        const newestContextPage = contextData.pages[0];
        if (!newestContextPage) {
          isConnected = false;
          return contextData;
        }
        if (newestContextPage.newerCursor) {
          return contextData;
        }

        const liveData = queryClient.getQueryData<ChatMessagesData>(
          chatKeys.messages(ref),
        );
        const contextEndId = newestContextPage.messages.at(-1)?.id;
        if (!liveData || !contextEndId) {
          isConnected = false;
          return contextData;
        }

        const liveMessages = chronologicalMessages(liveData);
        const overlapIndex = liveMessages.findIndex(
          (message) => message.id === contextEndId,
        );
        if (overlapIndex < 0) {
          isConnected = false;
          return contextData;
        }

        const contextIds = new Set(
          contextData.pages.flatMap((page) =>
            page.messages.map((message) => message.id),
          ),
        );
        const trailingMessages = liveMessages
          .slice(overlapIndex + 1)
          .filter((message) => !contextIds.has(message.id));
        if (trailingMessages.length === 0) {
          return contextData;
        }

        const authors = new Map(
          newestContextPage.authors.map((author) => [author.id, author]),
        );
        liveData.pages.forEach((page) => {
          page.authors.forEach((author) => authors.set(author.id, author));
        });
        return {
          ...contextData,
          pages: [
            {
              ...newestContextPage,
              messages: [...newestContextPage.messages, ...trailingMessages],
              authors: [...authors.values()],
            },
            ...contextData.pages.slice(1),
          ],
        };
      },
    );
    return isConnected;
  }, [queryClient, ref.accountId, ref.chatId]);

  const trackPagination = useCallback(
    (request: Promise<unknown>, onSuccess?: () => void) => {
      paginationRequestRef.current = request;
      const release = () => {
        if (paginationRequestRef.current === request) {
          paginationRequestRef.current = null;
        }
      };
      void request.then(() => {
        try {
          onSuccess?.();
        } finally {
          release();
        }
      }, release);
    },
    [],
  );

  const fetchOlder = useCallback(() => {
    if (
      !hasOlder ||
      isFetchingOlder ||
      isFetchingNewer ||
      paginationRequestRef.current
    ) {
      return;
    }
    trackPagination(fetchOlderPage({ cancelRefetch: false }));
  }, [
    fetchOlderPage,
    hasOlder,
    isFetchingNewer,
    isFetchingOlder,
    trackPagination,
  ]);

  const fetchNewer = useCallback(() => {
    if (
      !hasNewer ||
      isFetchingNewer ||
      isFetchingOlder ||
      paginationRequestRef.current
    ) {
      return;
    }
    trackPagination(fetchNewerPage({ cancelRefetch: false }), () => {
      if (isUnreadWindowActive && !reconcileUnreadWithLiveEnd()) {
        void resetUnreadContext();
      }
    });
  }, [
    fetchNewerPage,
    hasNewer,
    isFetchingOlder,
    isFetchingNewer,
    isUnreadWindowActive,
    reconcileUnreadWithLiveEnd,
    resetUnreadContext,
    trackPagination,
  ]);

  const openFirstUnread =
    useCallback(async (): Promise<OpenFirstUnreadResult> => {
      const requestId = unreadRequestIdRef.current + 1;
      unreadRequestIdRef.current = requestId;
      // Stop showing any previous contextual window before resolving the current
      // boundary. This also leaves the live cache untouched if resolution fails.
      await resetUnreadContext();
      if (unreadRequestIdRef.current !== requestId) {
        return {
          status: "error",
          error: new Error("Unread context request was superseded."),
        };
      }

      // The boundary can advance while this conversation stays mounted, so the
      // disabled query is forced on every activation rather than read as fresh.
      const result = await refetchUnread();

      if (unreadRequestIdRef.current !== requestId) {
        return {
          status: "error",
          error: new Error("Unread context request was superseded."),
        };
      }

      if (result.isError) {
        return { status: "error", error: result.error };
      }
      const installed = queryClient.getQueryData<ChatMessagesData>(
        chatKeys.unreadMessages(ref),
      );
      if (!installed) {
        return {
          status: "error",
          error: new Error("Unread context request was cancelled."),
        };
      }
      const initialIndex = installed.pageParams.findIndex(
        (param) => param.direction === "initial",
      );
      const resolved = installed.pages[initialIndex];
      if (!resolved) {
        return {
          status: "error",
          error: new Error("Unread context response has no initial page."),
        };
      }

      if (resolved.anchorStatus === "none") {
        await resetUnreadContext();
        return { status: "none" };
      }
      if (resolved.anchorStatus === "unavailable") {
        await resetUnreadContext();
        return { status: "unavailable" };
      }
      if (!resolved.firstUnreadMessageId) {
        await resetUnreadContext();
        return { status: "none" };
      }

      firstItemIndexState.current.initialPageSizeBaseline = null;
      if (!reconcileUnreadWithLiveEnd()) {
        await resetUnreadContext();
        return { status: "unavailable" };
      }
      return { status: "opened" };
    }, [
      queryClient,
      reconcileUnreadWithLiveEnd,
      ref.accountId,
      ref.chatId,
      refetchUnread,
      resetUnreadContext,
    ]);

  const firstItemIndex = useMemo(() => {
    const state = firstItemIndexState.current;
    if (state.chatKey !== chatKey || state.window !== activeWindow) {
      state.chatKey = chatKey;
      state.window = activeWindow;
      state.initialPageSizeBaseline = null;
    }

    const pages = activeData?.pages ?? [];
    const pageParams = activeData?.pageParams ?? [];
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
  }, [
    activeData?.pageParams,
    activeData?.pages,
    activeWindow,
    ref.accountId,
    ref.chatId,
  ]);

  return {
    messages,
    authorsById,
    firstUnreadMessageId,
    anchorStatus: initialPage?.anchorStatus ?? null,
    isUnreadWindowActive,
    liveEndMessageId: liveQuery.data?.pages[0]?.messages.at(-1)?.id ?? null,
    hasOlder,
    hasNewer,
    isFetchingOlder,
    isFetchingNewer,
    isInitialLoading:
      !enabled ||
      (isUnreadWindowActive ? unreadQuery.isPending : liveQuery.isPending),
    isError: isUnreadWindowActive ? unreadQuery.isError : liveQuery.isError,
    firstItemIndex,
    fetchOlder,
    fetchNewer,
    openFirstUnread,
    closeUnreadContext,
  };
};
