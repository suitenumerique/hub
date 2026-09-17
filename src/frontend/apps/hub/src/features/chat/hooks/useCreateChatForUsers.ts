import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { decorateChat } from "@/features/chat/chatRefs";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { AccountId, Chat, ChatRef } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import { normalizeChatParticipantIds } from "./useChatForUsers";

type CreateChatForUsersVariables = {
  participantIds: string[];
  name?: string;
  spaceId?: string;
  forceNew?: boolean;
};

export type UseCreateChatForUsersResult = {
  /**
   * Creates the conversation for the participants (or reuses an existing one)
   * and resolves with its ref so the composer can target a concrete chat.
   * `name` and `spaceId` only apply when a new group conversation is actually
   * created — see `Driver.createChatForUsers`. `forceNew` skips the reuse
   * check (the Salon flow: naming a room and picking its espace is a request
   * for a genuinely new one, even if the same people already share an
   * unrelated chat).
   */
  createChatForUsers: (
    participantIds: string[],
    name?: string,
    spaceId?: string,
    forceNew?: boolean,
  ) => Promise<ChatRef>;
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
    mutationFn: async ({ participantIds, name, spaceId, forceNew }) => {
      if (!accountId) {
        throw new Error(
          "useCreateChatForUsers: no account to create the conversation under.",
        );
      }
      const normalizedParticipantIds =
        normalizeChatParticipantIds(participantIds);
      const localChat = await getRegistry()
        .get(accountId)
        .createChatForUsers(normalizedParticipantIds, name, spaceId, forceNew);
      const chat: Chat = decorateChat(accountId, localChat);

      queryClient.setQueryData(chatKeys.chat(chat.ref), chat);
      // A `forceNew` chat isn't "the" chat for this participant set — there
      // may now be several — so it must not overwrite that cache entry,
      // which the ordinary New Chat search flow relies on to find the one
      // canonical existing conversation.
      if (!forceNew) {
        queryClient.setQueryData(
          chatKeys.chatForUsers(accountId, normalizedParticipantIds),
          chat,
        );
      }
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });

      return chat.ref;
    },
    meta: { noGlobalError: true },
  });

  const createChatForUsers = useCallback(
    (
      participantIds: string[],
      name?: string,
      spaceId?: string,
      forceNew?: boolean,
    ) => mutateAsync({ participantIds, name, spaceId, forceNew }),
    [mutateAsync],
  );

  return { createChatForUsers, isCreating: isPending };
};
