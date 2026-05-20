import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { getDriver } from "@/features/config/Config";
import type { ChatDocument } from "@/features/drivers/types";

export type UseChatDocumentsResult = {
  pinned: ChatDocument[];
  shared: ChatDocument[];
  multimedia: ChatDocument[];
  isInitialLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const EMPTY: ChatDocument[] = [];

export const useChatDocuments = (chatId: string): UseChatDocumentsResult => {
  const driver = getDriver();

  const query = useQuery({
    queryKey: ["chat-documents", chatId],
    queryFn: () => driver.getChatDocuments(chatId),
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    pinned: query.data?.pinned ?? EMPTY,
    shared: query.data?.shared ?? EMPTY,
    multimedia: query.data?.multimedia ?? EMPTY,
    isInitialLoading: query.isPending,
    isError: query.isError,
    refetch,
  };
};
