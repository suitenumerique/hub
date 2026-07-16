import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatRef,
  ChatMessage,
  ChatMessageAuthor,
  ChatMessagesPage,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export const CHAT_PAGE_SIZE = 50;

// Virtuoso uses a virtual index space. We start from a high anchor so that
// prepending older messages stays in positive territory; `firstItemIndex` is
// the anchor minus the number of currently loaded messages, and Virtuoso uses
// it to keep the visible scroll position stable across prepends.
const VIRTUOSO_INDEX_ANCHOR = 1_000_000;

type FirstItemIndexState = {
  chatKey: string | null;
  newestPageSizeBaseline: number | null;
};

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

type GroupPageParam = { roomIndex: number; cursor: string | null };
type GroupMessagesPage = ChatMessagesPage & {
  roomIndex: number;
  roomId: string;
};

export const useChatMessages = (
  ref: ChatRef,
  orderedRoomIds: string[] = [ref.chatId],
): UseChatMessagesResult => {
  const queryClient = useQueryClient();
  const firstItemIndexState = useRef<FirstItemIndexState>({
    chatKey: null,
    newestPageSizeBaseline: null,
  });

  const roomIds = orderedRoomIds.length > 0 ? orderedRoomIds : [ref.chatId];
  const roomChainKey = roomIds.join("\u0000");
  const observedChain = useRef({
    chatKey: `${ref.accountId}:${ref.chatId}`,
    roomChainKey,
  });
  const query = useInfiniteQuery({
    queryKey: chatKeys.messages(ref),
    queryFn: async ({ pageParam }): Promise<GroupMessagesPage> => {
      const target = pageParam ?? {
        roomIndex: roomIds.length - 1,
        cursor: null,
      };
      const roomId = roomIds[target.roomIndex];
      const isHistorical = roomId !== ref.chatId;
      try {
        const page = await getRegistry().get(ref.accountId).getChatMessages({
          chatId: roomId,
          cursor: target.cursor,
          limit: CHAT_PAGE_SIZE,
        });
        return {
          ...page,
          roomIndex: target.roomIndex,
          roomId,
          messages: page.messages.map((message) => ({
            ...message,
            sourceChatId: roomId,
            isHistorical,
            ...(isHistorical
              ? { canEdit: false, canDelete: false, thread: undefined }
              : {}),
          })),
        };
      } catch (error) {
        if (!isHistorical) {
          throw error;
        }
        // Matrix permissions and E2EE keys remain authoritative. An inaccessible
        // predecessor is skipped without breaking the active group timeline.
        return {
          messages: [],
          authors: [],
          nextCursor: null,
          roomIndex: target.roomIndex,
          roomId,
        };
      }
    },
    initialPageParam: null as GroupPageParam | null,
    getNextPageParam: (lastPage): GroupPageParam | undefined => {
      const currentRoomIndex = roomIds.indexOf(lastPage.roomId);
      if (lastPage.nextCursor) {
        return {
          roomIndex:
            currentRoomIndex >= 0 ? currentRoomIndex : lastPage.roomIndex,
          cursor: lastPage.nextCursor,
        };
      }
      if (currentRoomIndex > 0) {
        return { roomIndex: currentRoomIndex - 1, cursor: null };
      }
      return undefined;
    },
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  useEffect(() => {
    const chatKey = `${ref.accountId}:${ref.chatId}`;
    if (observedChain.current.chatKey !== chatKey) {
      observedChain.current = { chatKey, roomChainKey };
      return;
    }
    if (observedChain.current.roomChainKey === roomChainKey) {
      return;
    }
    observedChain.current.roomChainKey = roomChainKey;
    void queryClient.resetQueries({
      queryKey: chatKeys.messages({
        accountId: ref.accountId,
        chatId: ref.chatId,
      }),
      exact: true,
    });
  }, [queryClient, ref.accountId, ref.chatId, roomChainKey]);

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

  const lastFetchedPage = query.data?.pages[query.data.pages.length - 1];
  useEffect(() => {
    if (
      lastFetchedPage?.messages.length === 0 &&
      query.hasNextPage &&
      !query.isFetchingNextPage
    ) {
      // An empty Matrix page, an inaccessible predecessor, or a room with no
      // readable events must not strand pagination before the next ancestor.
      void query.fetchNextPage();
    }
  }, [
    lastFetchedPage,
    query.fetchNextPage,
    query.hasNextPage,
    query.isFetchingNextPage,
  ]);

  const fetchOlder = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  // Invariant: `newestPageSizeBaseline` is the *smallest* size ever observed for
  // the newest page (pages[0]) within the current chat. `firstItemIndex` is then
  // `ANCHOR - baseline - olderMessagesCount`, which keeps Virtuoso's virtual
  // index space stable across the two mutations we expect:
  //   - appending to the newest page (a sent/received message): its size only
  //     grows, so it stays ≥ the baseline → the baseline (and firstItemIndex)
  //     does not move, and the new row lands at the bottom without a jump;
  //   - prepending an older page: `olderMessagesCount` grows → firstItemIndex
  //     drops by exactly the prepend count, which is how Virtuoso anchors scroll.
  // Fragility: this assumes the newest page never *shrinks*. If a message were
  // removed from it, `newestPageSize` would dip below the baseline, lower it, and
  // shift every virtual index — causing a visible scroll jump. Deletion would
  // need an explicit re-baseline; today nothing removes messages.
  const firstItemIndex = useMemo(() => {
    const chatKey = `${ref.accountId}:${ref.chatId}:${roomChainKey}`;
    const state = firstItemIndexState.current;
    if (state.chatKey !== chatKey) {
      state.chatKey = chatKey;
      state.newestPageSizeBaseline = null;
    }

    const pages = query.data?.pages ?? [];
    const newestPageSize = pages[0]?.messages.length;
    if (newestPageSize === undefined) {
      return VIRTUOSO_INDEX_ANCHOR;
    }

    if (
      state.newestPageSizeBaseline === null ||
      newestPageSize < state.newestPageSizeBaseline
    ) {
      state.newestPageSizeBaseline = newestPageSize;
    }

    const olderMessagesCount = pages
      .slice(1)
      .reduce((total, page) => total + page.messages.length, 0);

    return (
      VIRTUOSO_INDEX_ANCHOR - state.newestPageSizeBaseline - olderMessagesCount
    );
  }, [query.data?.pages, ref.accountId, ref.chatId, roomChainKey]);

  return {
    messages,
    authorsById,
    hasOlder: Boolean(query.hasNextPage),
    isFetchingOlder: query.isFetchingNextPage,
    isInitialLoading: query.isPending,
    isError: query.isError,
    firstItemIndex,
    fetchOlder,
  };
};
