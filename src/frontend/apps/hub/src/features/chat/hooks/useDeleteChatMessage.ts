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

import { chatKeys } from "../chatKeys";

import {
  type ChatMessagesData,
  hasOptimisticMessageMutation,
  markOptimisticMessageMutation,
  type MessageMutationMarker,
  replaceMessageInPages,
} from "./chatCompositionCache";

type DeleteVariables = { message: ChatMessage };

type DeleteContext = {
  marker: MessageMutationMarker;
  optimisticReactions: ChatMessage["reactions"];
  messagesKey?: ReturnType<typeof chatKeys.messages>;
  previousTimelineMessage?: ChatMessage;
  threadKey?: ReturnType<typeof chatKeys.thread>;
  previousThreadMessage?: ChatMessage;
};

const toTombstone = (message: ChatMessage): ChatMessage => ({
  ...message,
  content: "",
  reactions: [],
  isDeleted: true,
  isEdited: false,
  canEdit: false,
  canDelete: false,
});

const patchThreadMessage = (
  detail: ChatThreadDetail,
  message: ChatMessage,
): ChatThreadDetail => ({
  ...detail,
  messages: detail.messages.map((current) =>
    current.id === message.id ? message : current,
  ),
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
      const messagesKey = isThreadReply ? undefined : chatKeys.messages(ref);
      const affectedThreadId = containingThreadId ?? message.thread?.id;
      const threadKey = affectedThreadId
        ? chatKeys.thread(ref, affectedThreadId)
        : undefined;
      await Promise.all([
        ...(messagesKey
          ? [queryClient.cancelQueries({ queryKey: messagesKey })]
          : []),
        ...(threadKey
          ? [queryClient.cancelQueries({ queryKey: threadKey })]
          : []),
      ]);
      const messages = messagesKey
        ? queryClient.getQueryData<ChatMessagesData>(messagesKey)
        : undefined;
      const thread = threadKey
        ? queryClient.getQueryData<ChatThreadDetail>(threadKey)
        : undefined;
      const previousTimelineMessage = messages?.pages
        .flatMap((page) => page.messages)
        .find((current) => current.id === message.id);
      const previousThreadMessage = thread?.messages.find(
        (current) => current.id === message.id,
      );
      const marker: MessageMutationMarker = {};
      const tombstone = markOptimisticMessageMutation(
        toTombstone(message),
        marker,
      );
      if (messagesKey) {
        queryClient.setQueryData<ChatMessagesData>(messagesKey, (data) =>
          data ? replaceMessageInPages(data, message.id, tombstone) : data,
        );
      }
      if (threadKey) {
        queryClient.setQueryData<ChatThreadDetail>(threadKey, (detail) =>
          detail ? patchThreadMessage(detail, tombstone) : detail,
        );
      }
      return {
        marker,
        optimisticReactions: tombstone.reactions,
        ...(messagesKey ? { messagesKey } : {}),
        ...(previousTimelineMessage ? { previousTimelineMessage } : {}),
        ...(threadKey ? { threadKey } : {}),
        ...(previousThreadMessage ? { previousThreadMessage } : {}),
      };
    },
    onSuccess: (message, _variables, context) => {
      if (context.messagesKey) {
        queryClient.setQueryData<ChatMessagesData>(
          context.messagesKey,
          (data) =>
            data ? replaceMessageInPages(data, message.id, message) : data,
        );
      }
      if (context.threadKey) {
        queryClient.setQueryData<ChatThreadDetail>(
          context.threadKey,
          (detail) => (detail ? patchThreadMessage(detail, message) : detail),
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
        if (context.messagesKey && context.previousTimelineMessage) {
          const previous = context.previousTimelineMessage;
          queryClient.setQueryData<ChatMessagesData>(
            context.messagesKey,
            (data) => {
              if (!data) {
                return data;
              }
              const current = data.pages
                .flatMap((page) => page.messages)
                .find((candidate) => candidate.id === previous.id);
              return current
                ? replaceMessageInPages(
                    data,
                    current.id,
                    rollbackOptimisticDeletion(
                      current,
                      previous,
                      context.marker,
                      context.optimisticReactions,
                    ),
                  )
                : data;
            },
          );
        }
        if (context.threadKey && context.previousThreadMessage) {
          const previous = context.previousThreadMessage;
          queryClient.setQueryData<ChatThreadDetail>(
            context.threadKey,
            (detail) => {
              if (!detail) {
                return detail;
              }
              const current = detail.messages.find(
                (candidate) => candidate.id === previous.id,
              );
              return current
                ? patchThreadMessage(
                    detail,
                    rollbackOptimisticDeletion(
                      current,
                      previous,
                      context.marker,
                      context.optimisticReactions,
                    ),
                  )
                : detail;
            },
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
