import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { decorateChat } from "@/features/chat/chatRefs";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { AccountId, Chat, ChatRef } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import { normalizeChatParticipantIds } from "./useChatForUsers";

type CreateChatForUsersVariables = {
  participantIds: string[];
};

export type UseCreateChatForUsersResult = {
  /**
   * Creates the conversation for the participants (or reuses an existing one)
   * and resolves with its ref so the composer can target a concrete chat.
   */
  createChatForUsers: (participantIds: string[]) => Promise<ChatRef>;
  isCreating: boolean;
};

/**
 * Starts a brand-new conversation for a participant set (a direct chat for one
 * person, a group for several). Seeds the single-chat and participant-set caches
 * with the result so the composer can target it immediately, and invalidates the
 * conversation lists so the new conversation appears in the sidebar.
 */
export const useCreateChatForUsers = (
  accountId: AccountId | null,
): UseCreateChatForUsersResult => {
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useMutation<
    ChatRef,
    Error,
    CreateChatForUsersVariables
  >({
    mutationFn: async ({ participantIds }) => {
      if (!accountId) {
        throw new Error(
          "useCreateChatForUsers: no account to create the conversation under.",
        );
      }
      const normalizedParticipantIds =
        normalizeChatParticipantIds(participantIds);
      const localChat = await getRegistry()
        .get(accountId)
        .createChatForUsers(normalizedParticipantIds);
      const chat: Chat = decorateChat(accountId, localChat);

      queryClient.setQueryData(chatKeys.chat(chat.ref), chat);
      queryClient.setQueryData(
        chatKeys.chatForUsers(accountId, normalizedParticipantIds),
        chat,
      );
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });

      return chat.ref;
    },
    meta: { noGlobalError: true },
  });

  const createChatForUsers = useCallback(
    (participantIds: string[]) => mutateAsync({ participantIds }),
    [mutateAsync],
  );

  return { createChatForUsers, isCreating: isPending };
};
