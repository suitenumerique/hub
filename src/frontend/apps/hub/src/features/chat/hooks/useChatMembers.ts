import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatMember, ChatRef } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

const EMPTY_MEMBERS: ChatMember[] = [];

export type UseChatMembersResult = {
  present: ChatMember[];
  pendingInvites: ChatMember[];
  isInitialLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

export const useChatMembers = (
  ref: ChatRef,
  enabled: boolean,
): UseChatMembersResult => {
  const query = useQuery({
    queryKey: chatKeys.members(ref),
    queryFn: () => getRegistry().get(ref.accountId).getChatMembers(ref.chatId),
    enabled,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    present: query.data?.present ?? EMPTY_MEMBERS,
    pendingInvites: query.data?.pendingInvites ?? EMPTY_MEMBERS,
    isInitialLoading: query.isPending && query.fetchStatus !== "idle",
    isError: query.isError,
    refetch,
  };
};
