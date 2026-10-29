import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { withHeldThreadReplies } from "@/features/chat/pendingThreadReplies";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMessage,
  ChatRef,
  ChatThreadDetail,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

const VIRTUOSO_INDEX_ANCHOR = 1_000_000;
const NO_MESSAGES: ChatMessage[] = [];

type FirstItemIndexState = {
  threadId: string | null;
  firstMessageId: string | null;
  firstItemIndex: number;
};

export type UseChatThreadResult = {
  thread: ChatThreadDetail | null;
  /**
   * Messages to show: the loaded replies, under the root once no older reply
   * remains to load, as the root opens an Element thread's timeline.
   */
  messages: ChatMessage[];
  /** Virtuoso index of `messages[0]`, moved back as older replies load. */
  firstItemIndex: number;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  /** The last request for older replies failed (cleared by the next one). */
  isFetchOlderError: boolean;
  isInitialLoading: boolean;
  isError: boolean;
  refetch: () => void;
  /** Loads older replies; also retries a failed request. */
  fetchOlder: () => void;
};

/**
 * Loads a single thread through the driver, keyed by `chatId` + `threadId`:
 * the root and the latest replies first, then older replies through
 * `fetchOlder`.
 */
export const useChatThread = (
  ref: ChatRef,
  threadId: string,
): UseChatThreadResult => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: chatKeys.thread(ref, threadId),
    queryFn: () =>
      getRegistry()
        .get(ref.accountId)
        .getChatThread({ chatId: ref.chatId, threadId })
        .then((detail) => withHeldThreadReplies(ref, threadId, detail)),
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });
  const {
    mutate: loadOlder,
    isPending,
    isError: loadFailed,
    variables: loadingThreadId,
  } = useMutation({
    mutationFn: (id: string) =>
      getRegistry()
        .get(ref.accountId)
        .loadOlderChatThreadReplies({ chatId: ref.chatId, threadId: id }),
    // Pending until the older replies are shown.
    onSuccess: (_result, id) =>
      queryClient.invalidateQueries({ queryKey: chatKeys.thread(ref, id) }),
    // The thread shows the failure, with its Retry.
    meta: { noGlobalError: true },
  });
  // The panel keeps this view for the next thread opened: a load still
  // running or failed for the previous one is not this thread's.
  const isThisThreadLoad = loadingThreadId === threadId;
  const isFetchingOlder = isPending && isThisThreadLoad;
  const isFetchOlderError = loadFailed && isThisThreadLoad;

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  const thread = query.data ?? null;
  const hasOlder = thread?.hasOlderReplies ?? false;
  // Virtuoso reports the top once per first row, which can show before the
  // load that brought it ends: ask again once that load is done.
  const wantsOlder = useRef(false);
  const fetchOlder = useCallback(() => {
    if (!hasOlder) {
      return;
    }
    if (isFetchingOlder) {
      wantsOlder.current = true;
      return;
    }
    loadOlder(threadId);
  }, [hasOlder, isFetchingOlder, loadOlder, threadId]);
  useEffect(() => {
    wantsOlder.current = false;
  }, [threadId]);
  useEffect(() => {
    if (isFetchingOlder || !wantsOlder.current) {
      return;
    }
    wantsOlder.current = false;
    if (!isFetchOlderError) {
      fetchOlder();
    }
  }, [fetchOlder, isFetchingOlder, isFetchOlderError]);

  const messages = useMemo(() => {
    if (!thread) {
      return NO_MESSAGES;
    }
    return hasOlder
      ? thread.messages.filter((message) => message.id !== thread.rootMessageId)
      : thread.messages;
  }, [hasOlder, thread]);

  // Virtuoso indexes follow message identities: when older replies are
  // shown above, move the virtual origin back by exactly that many rows, so
  // the replies being read stay in place. Appends leave it untouched.
  const firstItemIndexState = useRef<FirstItemIndexState>({
    threadId: null,
    firstMessageId: null,
    firstItemIndex: VIRTUOSO_INDEX_ANCHOR,
  });
  const firstItemIndex = useMemo(() => {
    const state = firstItemIndexState.current;
    const firstMessageId = messages[0]?.id ?? null;
    if (state.threadId !== threadId || !state.firstMessageId) {
      state.threadId = threadId;
      state.firstMessageId = firstMessageId;
      state.firstItemIndex = VIRTUOSO_INDEX_ANCHOR - messages.length;
      return state.firstItemIndex;
    }
    if (firstMessageId !== state.firstMessageId) {
      const previousFirstIndex = messages.findIndex(
        (message) => message.id === state.firstMessageId,
      );
      state.firstItemIndex =
        previousFirstIndex >= 0
          ? state.firstItemIndex - previousFirstIndex
          : VIRTUOSO_INDEX_ANCHOR - messages.length;
      state.firstMessageId = firstMessageId;
    }
    return state.firstItemIndex;
  }, [messages, threadId]);

  return {
    thread,
    messages,
    firstItemIndex,
    hasOlder,
    isFetchingOlder,
    isFetchOlderError,
    isInitialLoading: query.isPending,
    isError: query.isError,
    refetch,
    fetchOlder,
  };
};
