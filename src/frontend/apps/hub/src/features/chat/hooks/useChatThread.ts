import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { getDriver } from "@/features/config/Config";
import type { ChatThreadDetail } from "@/features/drivers/types";

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
  chatId: string,
  threadId: string,
): UseChatThreadResult => {
  const driver = getDriver();

  const query = useQuery({
    queryKey: ["chat-thread", chatId, threadId],
    queryFn: () => driver.getChatThread({ chatId, threadId }),
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
