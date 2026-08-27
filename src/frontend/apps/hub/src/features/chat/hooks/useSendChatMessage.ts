import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatMessage, ChatRef } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import {
  appendMessageToNewestPage,
  type ChatMessagesData,
  createOptimisticMessage,
  replaceMessageInPages,
} from "./chatCompositionCache";
import { useChatCompositionSupport } from "./useChatCompositionSupport";

type SendMessageVariables = { ref: ChatRef; content: string };

type SendMessageContext = {
  ref: ChatRef;
  messagesKey: QueryKey;
  previousMessages: ChatMessagesData | undefined;
  optimisticId: string;
};

export type UseSendChatMessageResult = {
  sendMessage: (content: string) => Promise<ChatMessage>;
  sendMessageTo: (ref: ChatRef, content: string) => Promise<ChatMessage>;
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
    mutationFn: ({ ref: targetRef, content }) => {
      const driver = getRegistry().get(targetRef.accountId);
      if (!driver.supportsComposition) {
        throw new Error("Conversation message composition is not available.");
      }
      return driver.sendChatMessage({ chatId: targetRef.chatId, content });
    },
    onMutate: async ({ ref: targetRef, content }) => {
      const messagesKey: QueryKey = chatKeys.messages(targetRef);
      await queryClient.cancelQueries({ queryKey: messagesKey });
      const previousMessages =
        queryClient.getQueryData<ChatMessagesData>(messagesKey);
      const optimistic = createOptimisticMessage(content, "optimistic-message");

      queryClient.setQueryData<ChatMessagesData>(messagesKey, (old) =>
        old ? appendMessageToNewestPage(old, optimistic) : old,
      );

      return {
        ref: targetRef,
        messagesKey,
        previousMessages,
        optimisticId: optimistic.id,
      };
    },
    onSuccess: (message, _variables, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData<ChatMessagesData>(context.messagesKey, (old) =>
        old ? replaceMessageInPages(old, context.optimisticId, message) : old,
      );
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(context.ref.accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
    },
    onError: (_error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(context.messagesKey, context.previousMessages);
      }
    },
    meta: { noGlobalError: true },
  });

  const sendMessage = useCallback(
    (content: string) => {
      if (!ref) {
        return Promise.reject(
          new Error("Conversation message composition requires a chat."),
        );
      }
      return mutateAsync({ ref, content });
    },
    [mutateAsync, ref],
  );

  const sendMessageTo = useCallback(
    (targetRef: ChatRef, content: string) =>
      mutateAsync({ ref: targetRef, content }),
    [mutateAsync],
  );

  return { sendMessage, sendMessageTo, isSending: isPending, isSupported };
};
