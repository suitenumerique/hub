import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatDocument, ChatRef } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export type UseChatDocumentsResult = {
  pinned: ChatDocument[];
  shared: ChatDocument[];
  multimedia: ChatDocument[];
  isInitialLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const EMPTY: ChatDocument[] = [];

export const useChatDocuments = (ref: ChatRef): UseChatDocumentsResult => {
  const query = useQuery({
    queryKey: chatKeys.documents(ref),
    queryFn: () =>
      getRegistry().get(ref.accountId).getChatDocuments(ref.chatId),
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
