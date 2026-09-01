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
  ChatMessageWindow,
  ChatRef,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import {
  getChatMessageEventVersion,
  getChatMessageWindowEventVersion,
  mergeChatMessageWindowSnapshot,
  tagChatMessageWindowEventVersion,
  type ChatMessageWindowMergeMode,
} from "./chatCompositionCache";

export const CHAT_PAGE_SIZE = 50;

const VIRTUOSO_INDEX_ANCHOR = 1_000_000;

type ChatPageParam = {
  firstItemIndex: number;
};

type UseChatMessagesOptions = {
  enabled?: boolean;
  readMarkerEventId: string | null;
};

export type OpenReadMarkerResult =
  | { status: "opened" }
  | { status: "unavailable" }
  | { status: "error"; error: unknown };

export type UseChatMessagesResult = {
  messages: ChatMessage[];
  authorsById: Map<string, ChatMessageAuthor>;
  windowId: string | null;
  readMarker: ChatMessageWindow["readMarker"];
  frozenReadMarkerEventId: string | null;
  hasOlder: boolean;
  hasNewer: boolean;
  isFetchingOlder: boolean;
  isFetchingNewer: boolean;
  isInitialLoading: boolean;
  isError: boolean;
  firstItemIndex: number;
  fetchOlder: () => void;
  fetchNewer: () => void;
  openReadMarker: () => Promise<OpenReadMarkerResult>;
};

type ChatMessagesData = InfiniteData<ChatMessageWindow, ChatPageParam>;

const INITIAL_PAGE_PARAM: ChatPageParam = {
  firstItemIndex: VIRTUOSO_INDEX_ANCHOR,
};

const rowIndexForMessage = (
  snapshot: ChatMessageWindow,
  messageIndex: number,
): number =>
  messageIndex +
  (snapshot.readMarker && snapshot.readMarker.insertionIndex <= messageIndex
    ? 1
    : 0);

/**
 * Keeps one common message at the same absolute Virtuoso index when a driver
 * replaces the bounded snapshot.
 */
const preservedFirstItemIndex = (
  current: ChatMessageWindow | undefined,
  incoming: ChatMessageWindow,
  currentFirstItemIndex: number,
): number => {
  if (!current) {
    return VIRTUOSO_INDEX_ANCHOR;
  }

  const incomingIndexById = new Map(
    incoming.messages.map((message, index) => [message.id, index]),
  );
  for (
    let currentIndex = 0;
    currentIndex < current.messages.length;
    currentIndex += 1
  ) {
    const incomingIndex = incomingIndexById.get(
      current.messages[currentIndex].id,
    );
    if (incomingIndex === undefined) {
      continue;
    }
    return (
      currentFirstItemIndex +
      rowIndexForMessage(current, currentIndex) -
      rowIndexForMessage(incoming, incomingIndex)
    );
  }

  return VIRTUOSO_INDEX_ANCHOR;
};

export const useChatMessages = (
  ref: ChatRef,
  options: UseChatMessagesOptions,
): UseChatMessagesResult => {
  const chatKey = ref.accountId + ":" + ref.chatId;
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const openingRequestId = useRef(0);
  const paginationRequest = useRef<Promise<void> | null>(null);
  const staleSnapshotRefetchScheduled = useRef(false);
  const mounted = useRef(true);
  const [paginationDirection, setPaginationDirection] = useState<
    "older" | "newer" | null
  >(null);
  const frozenMarker = useRef({
    chatKey,
    captured: false,
    eventId: null as string | null,
  });

  if (frozenMarker.current.chatKey !== chatKey) {
    frozenMarker.current = {
      chatKey,
      captured: false,
      eventId: null,
    };
  }
  if (enabled && !frozenMarker.current.captured) {
    frozenMarker.current.captured = true;
    frozenMarker.current.eventId = options.readMarkerEventId;
  }

  const frozenReadMarkerEventId = frozenMarker.current.eventId;
  const queryEnabled = enabled && frozenMarker.current.captured;
  const queryKey = chatKeys.messages(ref);

  const openStableWindow = useCallback(
    async (anchorEventId?: string) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const eventVersion = getChatMessageEventVersion(ref);
        const snapshot = await getRegistry()
          .get(ref.accountId)
          .openChatMessageWindow({
            chatId: ref.chatId,
            anchorEventId,
            readMarkerEventId: frozenReadMarkerEventId,
            limit: CHAT_PAGE_SIZE,
          });
        if (eventVersion === getChatMessageEventVersion(ref)) {
          return { snapshot, eventVersion };
        }
      }
      throw new Error("The chat timeline changed while its window was opening");
    },
    [frozenReadMarkerEventId, ref.accountId, ref.chatId],
  );

  const query = useInfiniteQuery<
    ChatMessageWindow,
    Error,
    ChatMessagesData,
    ReturnType<typeof chatKeys.messages>,
    ChatPageParam
  >({
    queryKey,
    queryFn: async () => {
      const { snapshot: incoming, eventVersion } = await openStableWindow();
      const current = queryClient.getQueryData<ChatMessagesData>(
        chatKeys.messages(ref),
      )?.pages[0];
      return tagChatMessageWindowEventVersion(
        mergeChatMessageWindowSnapshot(current, incoming, "replace"),
        eventVersion,
      );
    },
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam: () => undefined,
    getPreviousPageParam: () => undefined,
    enabled: queryEnabled,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: "always",
    structuralSharing: (oldData, newData) => {
      const previousData = oldData as ChatMessagesData | undefined;
      const nextData = newData as ChatMessagesData;
      const snapshotVersion = getChatMessageWindowEventVersion(
        nextData.pages[0],
      );
      if (
        snapshotVersion !== undefined &&
        snapshotVersion !== getChatMessageEventVersion(ref)
      ) {
        if (!staleSnapshotRefetchScheduled.current) {
          staleSnapshotRefetchScheduled.current = true;
          queueMicrotask(() => {
            staleSnapshotRefetchScheduled.current = false;
            void queryClient.invalidateQueries({
              queryKey: chatKeys.messages(ref),
              exact: true,
              refetchType: "active",
            });
          });
        }
        return previousData ?? nextData;
      }
      return nextData;
    },
    meta: { noGlobalError: true },
  });

  useEffect(() => {
    mounted.current = true;
    paginationRequest.current = null;
    setPaginationDirection(null);
    return () => {
      mounted.current = false;
      openingRequestId.current += 1;
    };
  }, [ref.accountId, ref.chatId]);

  const data = query.data;
  const snapshot = data?.pages[0];
  const messages = snapshot?.messages ?? [];
  const authorsById = useMemo(
    () =>
      new Map((snapshot?.authors ?? []).map((author) => [author.id, author])),
    [snapshot?.authors],
  );

  const commitWindow = useCallback(
    (
      incoming: ChatMessageWindow,
      mode: ChatMessageWindowMergeMode,
      expectedWindowId?: string,
    ): boolean => {
      let committed = false;
      queryClient.setQueryData<ChatMessagesData>(
        chatKeys.messages(ref),
        (current) => {
          const currentSnapshot = current?.pages[0];
          if (
            expectedWindowId &&
            currentSnapshot?.windowId !== expectedWindowId
          ) {
            return current;
          }
          const merged = mergeChatMessageWindowSnapshot(
            currentSnapshot,
            incoming,
            mode,
          );
          const currentFirstItemIndex =
            current?.pageParams[0]?.firstItemIndex ?? VIRTUOSO_INDEX_ANCHOR;
          committed = true;
          return {
            pages: [merged],
            pageParams: [
              {
                firstItemIndex: preservedFirstItemIndex(
                  currentSnapshot,
                  merged,
                  currentFirstItemIndex,
                ),
              },
            ],
          };
        },
      );
      return committed;
    },
    [queryClient, ref.accountId, ref.chatId],
  );

  const paginate = useCallback(
    (direction: "older" | "newer") => {
      if (paginationRequest.current) {
        return;
      }
      const current = queryClient.getQueryData<ChatMessagesData>(
        chatKeys.messages(ref),
      )?.pages[0];
      if (
        !current ||
        (direction === "older" ? !current.hasOlder : !current.hasNewer)
      ) {
        return;
      }

      setPaginationDirection(direction);
      const driver = getRegistry().get(ref.accountId);
      const request = (async () => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const eventVersion = getChatMessageEventVersion(ref);
          const incoming = await driver.paginateChatMessageWindow({
            chatId: ref.chatId,
            windowId: current.windowId,
            direction,
            limit: CHAT_PAGE_SIZE,
          });
          if (!incoming) {
            return;
          }
          if (eventVersion === getChatMessageEventVersion(ref)) {
            commitWindow(incoming, direction, current.windowId);
            return;
          }
        }
      })()
        .catch(() => undefined)
        .finally(() => {
          if (paginationRequest.current === request) {
            paginationRequest.current = null;
            if (mounted.current) {
              setPaginationDirection(null);
            }
          }
        });
      paginationRequest.current = request;
    },
    [commitWindow, queryClient, ref.accountId, ref.chatId],
  );

  const fetchOlder = useCallback(() => paginate("older"), [paginate]);
  const fetchNewer = useCallback(() => paginate("newer"), [paginate]);

  const openReadMarker =
    useCallback(async (): Promise<OpenReadMarkerResult> => {
      if (!frozenReadMarkerEventId) {
        return { status: "unavailable" };
      }

      const requestId = openingRequestId.current + 1;
      openingRequestId.current = requestId;
      await queryClient.cancelQueries({
        queryKey: chatKeys.messages(ref),
        exact: true,
      });

      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const { snapshot: incoming, eventVersion } = await openStableWindow(
            frozenReadMarkerEventId,
          );
          if (openingRequestId.current !== requestId) {
            return { status: "unavailable" };
          }
          if (incoming.readMarker?.eventId !== frozenReadMarkerEventId) {
            return { status: "unavailable" };
          }
          if (eventVersion !== getChatMessageEventVersion(ref)) {
            continue;
          }
          commitWindow(incoming, "replace");
          return { status: "opened" };
        }
        return { status: "unavailable" };
      } catch (error) {
        return { status: "error", error };
      }
    }, [
      commitWindow,
      frozenReadMarkerEventId,
      openStableWindow,
      queryClient,
      ref.accountId,
      ref.chatId,
    ]);

  return {
    messages,
    authorsById,
    windowId: snapshot?.windowId ?? null,
    readMarker: snapshot?.readMarker ?? null,
    frozenReadMarkerEventId,
    hasOlder: snapshot?.hasOlder ?? false,
    hasNewer: snapshot?.hasNewer ?? false,
    isFetchingOlder: paginationDirection === "older",
    isFetchingNewer: paginationDirection === "newer",
    // Cached snapshots belong to an earlier visit. Wait until this observer's
    // forced live open has settled before exposing rows or viewport receipts.
    isInitialLoading: !queryEnabled || !query.isFetchedAfterMount,
    isError: query.isError,
    firstItemIndex:
      data?.pageParams[0]?.firstItemIndex ?? VIRTUOSO_INDEX_ANCHOR,
    fetchOlder,
    fetchNewer,
    openReadMarker,
  };
};
