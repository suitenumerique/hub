import { skipToken, useQuery } from "@tanstack/react-query";
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

/** Members of `ref`, or none without a conversation yet. */
export const useChatMembers = (
  ref: ChatRef | null,
  enabled: boolean,
): UseChatMembersResult => {
  const query = useQuery({
    queryKey: ref ? chatKeys.members(ref) : ["chat-members", "none"],
    queryFn: ref
      ? () => getRegistry().get(ref.accountId).getChatMembers(ref.chatId)
      : skipToken,
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
