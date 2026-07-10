import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { decorateChat } from "@/features/chat/chatRefs";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { Chat } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import { useComposerAccountId } from "./useChatAccounts";

export type UseChatForUsersResult = {
  chat: Chat | null;
  isInitialLoading: boolean;
  isError: boolean;
};

export const normalizeChatParticipantIds = (userIds: string[]) =>
  [...new Set(userIds)].sort();

export const useChatForUsers = (userIds: string[]): UseChatForUsersResult => {
  const accountId = useComposerAccountId();
  const participantIds = useMemo(
    () => normalizeChatParticipantIds(userIds),
    [userIds],
  );

  const query = useQuery({
    queryKey: chatKeys.chatForUsers(accountId, participantIds),
    queryFn: async () => {
      if (!accountId) {
        return null;
      }
      const localChat = await getRegistry()
        .get(accountId)
        .getChatForUsers(participantIds);
      return localChat ? decorateChat(accountId, localChat) : null;
    },
    enabled: participantIds.length > 0 && accountId !== null,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  return {
    chat: query.data ?? null,
    isInitialLoading: query.isPending && participantIds.length > 0,
    isError: query.isError,
  };
};
