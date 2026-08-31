import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMessage,
  ChatRef,
  ChatThreadDetail,
} from "@/features/drivers/types";

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

type EditVariables = { messageId: string; content: string };

type MessageWindowSnapshot = {
  queryKey: ChatMessageWindowQueryKey;
  previousMessage?: ChatMessage;
};

type EditContext = {
  marker: MessageMutationMarker;
  messageWindows: MessageWindowSnapshot[];
  threadKey?: ReturnType<typeof chatKeys.thread>;
  previousThreadMessage?: ChatMessage;
};

const rollbackOptimisticEdit = (
  current: ChatMessage,
  previous: ChatMessage,
  marker: MessageMutationMarker,
): ChatMessage =>
  hasOptimisticMessageMutation(current, marker)
    ? {
        ...current,
        content: previous.content,
        isEdited: previous.isEdited,
      }
    : current;

const confirmOptimisticEdit = (
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
        isEdited: confirmed.isEdited,
      };

/** Edits either a main-timeline message or a message rendered in one thread. */
export const useEditChatMessage = (
  ref: ChatRef | null,
  containingThreadId?: string,
) => {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation<
    ChatMessage,
    Error,
    EditVariables,
    EditContext
  >({
    mutationFn: ({ messageId, content }) => {
      if (!ref) {
        throw new Error("Editing a message requires a conversation.");
      }
      return getRegistry()
        .get(ref.accountId)
        .editChatMessage({
          chatId: ref.chatId,
          messageId,
          content,
          ...(containingThreadId && messageId !== containingThreadId
            ? { threadId: containingThreadId }
            : {}),
        });
    },
    onMutate: async ({ messageId, content }) => {
      if (!ref) {
        throw new Error("Editing a message requires a conversation.");
      }
      const isThreadReply = Boolean(
        containingThreadId && messageId !== containingThreadId,
      );
      const messageWindowKeys = isThreadReply
        ? []
        : [...chatKeys.messageWindows(ref)];
      const threadKey = containingThreadId
        ? chatKeys.thread(ref, containingThreadId)
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
          messageId,
        ),
      }));
      const thread = threadKey
        ? queryClient.getQueryData<ChatThreadDetail>(threadKey)
        : undefined;
      const previousThreadMessage = thread?.messages.find(
        (message) => message.id === messageId,
      );
      const marker: MessageMutationMarker = {};

      const patchMessage = (message: ChatMessage): ChatMessage =>
        markOptimisticMessageMutation(
          { ...message, content, isEdited: true },
          marker,
        );
      messageWindows.forEach(({ queryKey }) => {
        queryClient.setQueryData<ChatMessagesData>(queryKey, (data) =>
          data ? updateMessageInPages(data, messageId, patchMessage) : data,
        );
      });
      if (threadKey) {
        queryClient.setQueryData<ChatThreadDetail>(threadKey, (detail) =>
          detail
            ? updateThreadMessage(detail, messageId, patchMessage)
            : detail,
        );
      }
      return {
        marker,
        messageWindows,
        ...(threadKey ? { threadKey } : {}),
        ...(previousThreadMessage ? { previousThreadMessage } : {}),
      };
    },
    onSuccess: (message, _variables, context) => {
      if (!ref) {
        return;
      }
      context.messageWindows.forEach(({ queryKey }) => {
        queryClient.setQueryData<ChatMessagesData>(queryKey, (data) =>
          data
            ? updateMessageInPages(data, message.id, (current) =>
                confirmOptimisticEdit(current, message, context.marker),
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
                  confirmOptimisticEdit(current, message, context.marker),
                )
              : detail,
        );
        void queryClient.invalidateQueries({ queryKey: chatKeys.threads(ref) });
      }
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
                  rollbackOptimisticEdit(
                    current,
                    previousMessage,
                    context.marker,
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
                    rollbackOptimisticEdit(current, previous, context.marker),
                  )
                : detail,
          );
        }
      }
    },
    meta: { noGlobalError: true },
  });

  const editMessage = useCallback(
    (messageId: string, content: string) => mutateAsync({ messageId, content }),
    [mutateAsync],
  );

  return { editMessage, isEditing: isPending };
};
