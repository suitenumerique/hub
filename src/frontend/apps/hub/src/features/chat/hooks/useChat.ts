import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { decorateChat } from "@/features/chat/chatRefs";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { Chat, ChatRef } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export type UseChatResult = {
  chat: Chat | null;
  isInitialLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

/**
 * Loads a single conversation through the matching account driver. Keyed by
 * full `ChatRef` so identical local ids from different accounts never collide.
 */
export const useChat = (ref: ChatRef | null): UseChatResult => {
  const query = useQuery({
    queryKey: ref ? chatKeys.chat(ref) : chatKeys.noChat(),
    queryFn: async () => {
      if (!ref) {
        throw new Error("useChat requires a ChatRef.");
      }
      const localChat = await getRegistry()
        .get(ref.accountId)
        .getChat(ref.chatId);
      return decorateChat(ref.accountId, localChat);
    },
    enabled: ref !== null,
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
