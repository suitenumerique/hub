import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMessage,
  ChatRef,
  ChatThreadDetail,
} from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { chatKeys, type ChatMessageWindowQueryKey } from "../chatKeys";

import {
  type ChatMessagesData,
  getMessageFromPages,
  getOptimisticMessageMutationMarker,
  hasOptimisticMessageMutation,
  markOptimisticMessageMutation,
  type MessageMutationMarker,
  updateMessageInPages,
  updateThreadMessage,
} from "./chatCompositionCache";

type DeleteVariables = { message: ChatMessage };

type MessageWindowSnapshot = {
  queryKey: ChatMessageWindowQueryKey;
  previousMessage?: ChatMessage;
};

type DeleteContext = {
  marker: MessageMutationMarker;
  optimisticReactions: ChatMessage["reactions"];
  messageWindows: MessageWindowSnapshot[];
  threadKey?: ReturnType<typeof chatKeys.thread>;
  previousThreadMessage?: ChatMessage;
};

const toTombstone = (
  message: ChatMessage,
  reactions: ChatMessage["reactions"],
): ChatMessage => ({
  ...message,
  content: "",
  reactions,
  isDeleted: true,
  isEdited: false,
  canEdit: false,
  canDelete: false,
});

const rollbackOptimisticDeletion = (
  current: ChatMessage,
  previous: ChatMessage,
  marker: MessageMutationMarker,
  optimisticReactions: ChatMessage["reactions"],
): ChatMessage =>
  hasOptimisticMessageMutation(current, marker)
    ? {
        ...current,
        content: previous.content,
        reactions:
          current.reactions === optimisticReactions
            ? previous.reactions
            : current.reactions,
        isDeleted: previous.isDeleted,
        isEdited: previous.isEdited,
        canEdit: previous.canEdit,
        canDelete: previous.canDelete,
      }
    : current;

const confirmOptimisticDeletion = (
  current: ChatMessage,
  confirmed: ChatMessage,
  marker: MessageMutationMarker,
): ChatMessage =>
  getOptimisticMessageMutationMarker(current) !== undefined &&
  !hasOptimisticMessageMutation(current, marker)
    ? current
    : {
        ...current,
        content: confirmed.content,
        reactions: confirmed.reactions,
        isDeleted: confirmed.isDeleted,
        isEdited: confirmed.isEdited,
        canEdit: confirmed.canEdit,
        canDelete: confirmed.canDelete,
      };

/** Redacts a timeline message, a thread root, or a reply globally in Matrix. */
export const useDeleteChatMessage = (
  ref: ChatRef,
  containingThreadId?: string,
) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation<
    ChatMessage,
    Error,
    DeleteVariables,
    DeleteContext
  >({
    mutationFn: ({ message }) =>
      getRegistry()
        .get(ref.accountId)
        .deleteChatMessage({
          chatId: ref.chatId,
          messageId: message.id,
          ...(containingThreadId && message.id !== containingThreadId
            ? { threadId: containingThreadId }
            : {}),
        }),
    onMutate: async ({ message }) => {
      const isThreadReply = Boolean(
        containingThreadId && message.id !== containingThreadId,
      );
      const messageWindowKeys = isThreadReply ? [] : [chatKeys.messages(ref)];
      const affectedThreadId = containingThreadId ?? message.thread?.id;
      const threadKey = affectedThreadId
        ? chatKeys.thread(ref, affectedThreadId)
        : undefined;
      await Promise.all([
        ...messageWindowKeys.map((queryKey) =>
          queryClient.cancelQueries({ queryKey, exact: true }),
        ),
        ...(threadKey
          ? [queryClient.cancelQueries({ queryKey: threadKey, exact: true })]
          : []),
      ]);
      const messageWindows = messageWindowKeys.map((queryKey) => ({
        queryKey,
        previousMessage: getMessageFromPages(
          queryClient.getQueryData<ChatMessagesData>(queryKey),
          message.id,
        ),
      }));
      const thread = threadKey
        ? queryClient.getQueryData<ChatThreadDetail>(threadKey)
        : undefined;
      const previousThreadMessage = thread?.messages.find(
        (current) => current.id === message.id,
      );
      const marker: MessageMutationMarker = {};
      const optimisticReactions: ChatMessage["reactions"] = [];
      const toOptimisticTombstone = (current: ChatMessage) =>
        markOptimisticMessageMutation(
          toTombstone(current, optimisticReactions),
          marker,
        );
      messageWindows.forEach(({ queryKey }) => {
        queryClient.setQueryData<ChatMessagesData>(queryKey, (data) =>
          data
            ? updateMessageInPages(data, message.id, toOptimisticTombstone)
            : data,
        );
      });
      if (threadKey) {
        queryClient.setQueryData<ChatThreadDetail>(threadKey, (detail) =>
          detail
            ? updateThreadMessage(detail, message.id, toOptimisticTombstone)
            : detail,
        );
      }
      return {
        marker,
        optimisticReactions,
        messageWindows,
        ...(threadKey ? { threadKey } : {}),
        ...(previousThreadMessage ? { previousThreadMessage } : {}),
      };
    },
    onSuccess: (message, _variables, context) => {
      context.messageWindows.forEach(({ queryKey }) => {
        queryClient.setQueryData<ChatMessagesData>(queryKey, (data) =>
          data
            ? updateMessageInPages(data, message.id, (current) =>
                confirmOptimisticDeletion(current, message, context.marker),
              )
            : data,
        );
      });
      if (context.threadKey) {
        queryClient.setQueryData<ChatThreadDetail>(
          context.threadKey,
          (detail) =>
            detail
              ? updateThreadMessage(detail, message.id, (current) =>
                  confirmOptimisticDeletion(current, message, context.marker),
                )
              : detail,
        );
      }
      void queryClient.invalidateQueries({ queryKey: chatKeys.threads(ref) });
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(ref.accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
    },
    onError: (_error, _variables, context) => {
      if (context) {
        context.messageWindows.forEach(({ queryKey, previousMessage }) => {
          if (!previousMessage) {
            return;
          }
          queryClient.setQueryData<ChatMessagesData>(queryKey, (data) =>
            data
              ? updateMessageInPages(data, previousMessage.id, (current) =>
                  rollbackOptimisticDeletion(
                    current,
                    previousMessage,
                    context.marker,
                    context.optimisticReactions,
                  ),
                )
              : data,
          );
        });
        if (context.threadKey && context.previousThreadMessage) {
          const previous = context.previousThreadMessage;
          queryClient.setQueryData<ChatThreadDetail>(
            context.threadKey,
            (detail) =>
              detail
                ? updateThreadMessage(detail, previous.id, (current) =>
                    rollbackOptimisticDeletion(
                      current,
                      previous,
                      context.marker,
                      context.optimisticReactions,
                    ),
                  )
                : detail,
          );
        }
      }
      notify.error(t("The message could not be deleted. Please try again."));
    },
    meta: { noGlobalError: true },
  });

  const deleteMessage = useCallback(
    (message: ChatMessage) => mutateAsync({ message }),
    [mutateAsync],
  );

  return { deleteMessage, isDeleting: isPending };
};
