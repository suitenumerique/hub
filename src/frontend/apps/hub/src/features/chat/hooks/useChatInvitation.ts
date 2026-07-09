import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { decorateChat } from "@/features/chat/chatRefs";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { Chat, ChatRef, LocalChat } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { chatKeys } from "../chatKeys";

export type UseChatInvitationResult = {
  /** Joins the room; resolves with the now-joined chat. Rejects on failure. */
  accept: () => Promise<Chat>;
  /** Leaves the room. Rejects on failure. */
  refuse: () => Promise<void>;
  isAccepting: boolean;
  isRefusing: boolean;
};

/**
 * Accept/refuse actions for a pending incoming invitation, wired to the matching
 * account driver and the React Query cache.
 *
 * - **Accept** joins the room and writes the now-joined chat into the
 *   single-chat cache, so the open route flips from the invitation detail view
 *   to the normal conversation in place (no navigation). The conversation list
 *   and the chat's message cache are invalidated so they re-read the joined room.
 * - **Refuse** leaves the room and drops the chat's single-chat and message
 *   caches; the list is invalidated so the row disappears. Navigation away from
 *   the refused room is the caller's responsibility (the route still points at
 *   it).
 *
 * Both surface a failure as an error toast and re-reject so the caller can keep
 * the invitation detail view visible.
 */
export const useChatInvitation = (
  chatRef: ChatRef | null,
): UseChatInvitationResult => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const acceptMutation = useMutation<Chat, Error, void>({
    mutationFn: async () => {
      if (!chatRef) {
        throw new Error("useChatInvitation.accept requires a ChatRef.");
      }
      const localChat: LocalChat = await getRegistry()
        .get(chatRef.accountId)
        .acceptChatInvitation(chatRef.chatId);
      return decorateChat(chatRef.accountId, localChat);
    },
    onSuccess: (chat) => {
      if (!chatRef) {
        return;
      }
      queryClient.setQueryData<Chat>(chatKeys.chat(chatRef), chat);
      void queryClient.invalidateQueries({
        queryKey: chatKeys.messages(chatRef),
      });
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(chatRef.accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
    },
    onError: () => {
      notify.error(
        t("The invitation could not be accepted. Please try again."),
      );
    },
    meta: { noGlobalError: true },
  });

  const refuseMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!chatRef) {
        throw new Error("useChatInvitation.refuse requires a ChatRef.");
      }
      await getRegistry()
        .get(chatRef.accountId)
        .refuseChatInvitation(chatRef.chatId);
    },
    onSuccess: () => {
      if (!chatRef) {
        return;
      }
      queryClient.removeQueries({ queryKey: chatKeys.chat(chatRef) });
      queryClient.removeQueries({ queryKey: chatKeys.messages(chatRef) });
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(chatRef.accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
    },
    onError: () => {
      notify.error(t("The invitation could not be refused. Please try again."));
    },
    meta: { noGlobalError: true },
  });

  const accept = useCallback(
    () => acceptMutation.mutateAsync(),
    [acceptMutation],
  );
  const refuse = useCallback(
    () => refuseMutation.mutateAsync(),
    [refuseMutation],
  );

  return {
    accept,
    refuse,
    isAccepting: acceptMutation.isPending,
    isRefusing: refuseMutation.isPending,
  };
};
