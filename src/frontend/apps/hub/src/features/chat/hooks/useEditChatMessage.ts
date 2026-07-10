import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMessage,
  ChatRef,
  ChatThreadDetail,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import {
  type ChatMessagesData,
  hasOptimisticMessageMutation,
  markOptimisticMessageMutation,
  type MessageMutationMarker,
  replaceMessageInPages,
  replaceThreadMessage,
} from "./chatCompositionCache";

type EditVariables = { messageId: string; content: string };

type EditContext = {
  marker: MessageMutationMarker;
  messagesKey?: ReturnType<typeof chatKeys.messages>;
  previousTimelineMessage?: ChatMessage;
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
      const messagesKey = isThreadReply ? undefined : chatKeys.messages(ref);
      const threadKey = containingThreadId
        ? chatKeys.thread(ref, containingThreadId)
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
        .find((message) => message.id === messageId);
      const previousThreadMessage = thread?.messages.find(
        (message) => message.id === messageId,
      );
      const marker: MessageMutationMarker = {};

      const patchMessage = (message: ChatMessage): ChatMessage => ({
        ...markOptimisticMessageMutation(message, marker),
        content,
        isEdited: true,
      });
      if (messagesKey) {
        queryClient.setQueryData<ChatMessagesData>(messagesKey, (data) => {
          if (!data) {
            return data;
          }
          const current = data.pages
            .flatMap((page) => page.messages)
            .find((message) => message.id === messageId);
          return current
            ? replaceMessageInPages(data, messageId, patchMessage(current))
            : data;
        });
      }
      if (threadKey) {
        queryClient.setQueryData<ChatThreadDetail>(threadKey, (detail) => {
          if (!detail) {
            return detail;
          }
          const current = detail.messages.find(
            (message) => message.id === messageId,
          );
          return current
            ? replaceThreadMessage(detail, messageId, patchMessage(current))
            : detail;
        });
      }
      return {
        marker,
        ...(messagesKey ? { messagesKey } : {}),
        ...(previousTimelineMessage ? { previousTimelineMessage } : {}),
        ...(threadKey ? { threadKey } : {}),
        ...(previousThreadMessage ? { previousThreadMessage } : {}),
      };
    },
    onSuccess: (message, _variables, context) => {
      if (!ref) {
        return;
      }
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
          (detail) =>
            detail ? replaceThreadMessage(detail, message.id, message) : detail,
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
                .find((message) => message.id === previous.id);
              return current
                ? replaceMessageInPages(
                    data,
                    current.id,
                    rollbackOptimisticEdit(current, previous, context.marker),
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
                (message) => message.id === previous.id,
              );
              return current
                ? replaceThreadMessage(
                    detail,
                    current.id,
                    rollbackOptimisticEdit(current, previous, context.marker),
                  )
                : detail;
            },
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
