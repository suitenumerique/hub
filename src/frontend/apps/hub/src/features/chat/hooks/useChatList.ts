import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { getDriver } from "@/features/config/Config";
import type { Chat } from "@/features/drivers/types";

export type UseChatListResult = {
  chatList: Chat[];
  isInitialLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

/**
 * Loads a single conversation through the driver. Keyed by `chatId` so two
 * tabs on different chats keep distinct caches; shared with no other query.
 */
export const useChatList = (): UseChatListResult => {
  const driver = getDriver();

  useEffect(() => {
    driver.onChatList(refetch);
  }, []);

  const query = useQuery({
    queryKey: ["chat-list"],
    queryFn: async () => {
      return driver.getChatList()
    },
    enabled: false,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    chatList: query.data ?? [],
    isInitialLoading: query.isPending,
    isError: query.isError,
    refetch,
  };
};
