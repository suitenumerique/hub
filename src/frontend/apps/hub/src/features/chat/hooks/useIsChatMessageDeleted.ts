import {
  hashKey,
  type InfiniteData,
  type QueryKey,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import type {
  ChatMessagesPage,
  ChatRef,
  ChatThreadDetail,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

/** Data a query already holds, kept in sync without ever fetching it. */
const useCachedQueryData = <T>(queryKey: QueryKey): T | undefined => {
  const queryClient = useQueryClient();
  const queryHash = hashKey(queryKey);
  const subscribe = useCallback(
    (onChange: () => void) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryHash === queryHash) {
          onChange();
        }
      }),
    [queryClient, queryHash],
  );
  const getSnapshot = () => queryClient.getQueryData<T>(queryKey);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

/**
 * Whether a loaded message was deleted, read from the messages already held
 * for the conversation or the thread it belongs to; nothing is fetched. A
 * message they do not hold, such as one still being sent, is not deleted.
 */
export const useIsChatMessageDeleted = (
  chatRef: ChatRef,
  threadId: string | undefined,
  messageId: string,
): boolean => {
  const data = useCachedQueryData<
    InfiniteData<ChatMessagesPage> | ChatThreadDetail
  >(threadId ? chatKeys.thread(chatRef, threadId) : chatKeys.messages(chatRef));

  return useMemo(() => {
    if (!data) {
      return false;
    }
    const messages =
      "pages" in data
        ? data.pages.flatMap((page) => page.messages)
        : data.messages;
    return messages.some(
      (message) => message.id === messageId && message.isDeleted,
    );
  }, [data, messageId]);
};
