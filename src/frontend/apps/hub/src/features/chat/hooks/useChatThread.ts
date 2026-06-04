import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef, ChatThreadDetail } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export type UseChatThreadResult = {
  thread: ChatThreadDetail | null;
  isInitialLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

/**
 * Loads the full content of a single thread (root message + replies) through
 * the driver, keyed by `chatId` + `threadId`.
 */
export const useChatThread = (
  ref: ChatRef,
  threadId: string,
): UseChatThreadResult => {
  const query = useQuery({
    queryKey: chatKeys.thread(ref, threadId),
    queryFn: () =>
      getRegistry().get(ref.accountId).getChatThread({
        chatId: ref.chatId,
        threadId,
      }),
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    thread: query.data ?? null,
    isInitialLoading: query.isPending,
    isError: query.isError,
    refetch,
  };
};
