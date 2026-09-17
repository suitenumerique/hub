import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { decorateChat } from "@/features/chat/chatRefs";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  AccountId,
  Chat,
  ChatRef,
  CreateChatOptions,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import { normalizeChatParticipantIds } from "./useChatForUsers";

type CreateChatForUsersVariables = {
  participantIds: string[];
  options?: CreateChatOptions;
};

export type UseCreateChatForUsersResult = {
  /**
   * Creates the conversation for the participants (or reuses an existing one)
   * and resolves with its ref so the composer can target a concrete chat.
   * `options.name` and `options.spaceId` only apply when a new group
   * conversation is actually created — see `Driver.createChatForUsers`.
   * `options.forceNew` skips the reuse
   * check (the Salon flow: naming a room and picking its espace is a request
   * for a genuinely new one, even if the same people already share an
   * unrelated chat).
   */
  createChatForUsers: (
    participantIds: string[],
    options?: CreateChatOptions,
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
    mutationFn: async ({ participantIds, options }) => {
      if (!accountId) {
        throw new Error(
          "useCreateChatForUsers: no account to create the conversation under.",
        );
      }
      const normalizedParticipantIds =
        normalizeChatParticipantIds(participantIds);
      const localChat = await getRegistry()
        .get(accountId)
        .createChatForUsers(normalizedParticipantIds, options);
      const chat: Chat = decorateChat(accountId, localChat);

      queryClient.setQueryData(chatKeys.chat(chat.ref), chat);
      // A `forceNew` chat isn't "the" chat for this participant set — there
      // may now be several — so it must not overwrite that cache entry,
      // which the ordinary New Chat search flow relies on to find the one
      // canonical existing conversation. The entry it would overwrite is
      // keyed by encryption: a clear room and an encrypted one are different
      // conversations, so a new room only ever answers for its own kind.
      if (!options?.forceNew) {
        queryClient.setQueryData(
          chatKeys.chatForUsers(
            accountId,
            normalizedParticipantIds,
            Boolean(chat.encrypted),
          ),
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
    (participantIds: string[], options?: CreateChatOptions) =>
      mutateAsync({ participantIds, options }),
    [mutateAsync],
  );

  return { createChatForUsers, isCreating: isPending };
};
