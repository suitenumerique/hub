import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { getDriver } from "@/features/config/Config";
import type { Chat } from "@/features/drivers/types";

export type UseChatResult = {
  chat: Chat | null;
  isInitialLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

/**
 * Loads a single conversation through the driver. Keyed by `chatId` so two
 * tabs on different chats keep distinct caches; shared with no other query.
 */
export const useChat = (chatId: string | null): UseChatResult => {
  const driver = getDriver();

  const query = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => driver.getChat(chatId as string),
    enabled: chatId !== null,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    chat: query.data ?? null,
    isInitialLoading: query.isPending,
    isError: query.isError,
    refetch,
  };
};
