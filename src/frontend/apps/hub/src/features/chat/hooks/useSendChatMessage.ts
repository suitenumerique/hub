import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatAttachment,
  ChatComposedMessage,
  ChatMessage,
  ChatRef,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import {
  appendMessageToNewestPage,
  type ChatMessagesData,
  createOptimisticMessage,
  removeMessageFromPages,
  replaceMessageInPages,
} from "./chatCompositionCache";
import { useChatCompositionSupport } from "./useChatCompositionSupport";

type SendMessageVariables = {
  ref: ChatRef;
  /** The text, or the caption of `attachment` (usually empty). */
  message: ChatComposedMessage;
  /** Posts this uploaded file instead of a text message. */
  attachment?: ChatAttachment;
};

type SendMessageContext = {
  ref: ChatRef;
  messagesKey: QueryKey;
  optimisticId: string;
};

export type UseSendChatMessageResult = {
  sendMessage: (message: ChatComposedMessage) => Promise<ChatMessage>;
  sendMessageTo: (
    ref: ChatRef,
    message: ChatComposedMessage,
    attachment?: ChatAttachment,
  ) => Promise<ChatMessage>;
  sendAttachment: (attachment: ChatAttachment) => Promise<ChatMessage>;
  isSending: boolean;
  isSupported: boolean;
};

export const useSendChatMessage = (
  ref: ChatRef | null,
): UseSendChatMessageResult => {
  const queryClient = useQueryClient();
  const isSupported = useChatCompositionSupport(ref);

  const { mutateAsync, isPending } = useMutation<
    ChatMessage,
    Error,
    SendMessageVariables,
    SendMessageContext
  >({
    mutationFn: ({ ref: targetRef, message, attachment }) => {
      const driver = getRegistry().get(targetRef.accountId);
      if (!driver.supportsComposition) {
        throw new Error("Conversation message composition is not available.");
      }
      return driver.sendChatMessage({
        ...message,
        chatId: targetRef.chatId,
        attachment,
      });
    },
    onMutate: async ({ ref: targetRef, message, attachment }) => {
      const messagesKey: QueryKey = chatKeys.messages(targetRef);
      await queryClient.cancelQueries({ queryKey: messagesKey });
      const optimistic = createOptimisticMessage(
        message,
        "optimistic-message",
        attachment,
      );

      queryClient.setQueryData<ChatMessagesData>(messagesKey, (old) =>
        old ? appendMessageToNewestPage(old, optimistic) : old,
      );

      return {
        ref: targetRef,
        messagesKey,
        optimisticId: optimistic.id,
      };
    },
    onSuccess: async (message, _variables, context) => {
      if (!context) {
        return;
      }
      // A reconnect can refetch the room before /sync includes our send and
      // remove its optimistic row. Cancel that stale read, then retain the
      // confirmed event even when there is no optimistic row left to replace.
      await queryClient.cancelQueries({ queryKey: context.messagesKey });
      queryClient.setQueryData<ChatMessagesData>(context.messagesKey, (old) => {
        if (!old) return old;
        if (
          old.pages.some((page) =>
            page.messages.some((row) => row.id === message.id),
          )
        ) {
          return removeMessageFromPages(old, context.optimisticId);
        }
        if (
          old.pages.some((page) =>
            page.messages.some((row) => row.id === context.optimisticId),
          )
        ) {
          return replaceMessageInPages(old, context.optimisticId, message);
        }
        return old.pages[0]?.isAtLiveEnd === false
          ? old
          : appendMessageToNewestPage(old, message);
      });
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(context.ref.accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
    },
    onError: (_error, _variables, context) => {
      if (context) {
        // Remove only this failed send. Restoring an earlier cache snapshot
        // would discard messages or decrypted content received in the meantime.
        queryClient.setQueryData<ChatMessagesData>(
          context.messagesKey,
          (old) =>
            old ? removeMessageFromPages(old, context.optimisticId) : old,
        );
      }
    },
    meta: { noGlobalError: true },
  });

  const sendMessage = useCallback(
    (message: ChatComposedMessage) => {
      if (!ref) {
        return Promise.reject(
          new Error("Conversation message composition requires a chat."),
        );
      }
      return mutateAsync({ ref, message });
    },
    [mutateAsync, ref],
  );

  const sendMessageTo = useCallback(
    (
      targetRef: ChatRef,
      message: ChatComposedMessage,
      attachment?: ChatAttachment,
    ) => mutateAsync({ ref: targetRef, message, attachment }),
    [mutateAsync],
  );

  const sendAttachment = useCallback(
    (attachment: ChatAttachment) => {
      if (!ref) {
        return Promise.reject(
          new Error("Sending an attachment requires a chat."),
        );
      }
      return mutateAsync({ ref, message: { content: "" }, attachment });
    },
    [mutateAsync, ref],
  );

  return {
    sendMessage,
    sendMessageTo,
    sendAttachment,
    isSending: isPending,
    isSupported,
  };
};
