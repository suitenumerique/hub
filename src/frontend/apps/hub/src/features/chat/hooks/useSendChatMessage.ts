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

type SendMessageVariables = { content: string };

type SendMessageContext = {
  messagesKey: QueryKey;
  previousMessages: ChatMessagesData | undefined;
  optimisticId: string;
};

export type UseSendChatMessageResult = {
  sendMessage: (content: string) => Promise<ChatMessage>;
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
    mutationFn: ({ content }) => {
      if (!ref || !isSupported) {
        throw new Error("Conversation message composition is not available.");
      }
      return getRegistry()
        .get(ref.accountId)
        .sendChatMessage({ chatId: ref.chatId, content });
    },
    onMutate: async ({ content }) => {
      if (!ref) {
        throw new Error("Conversation message composition requires a chat.");
      }
      const messagesKey: QueryKey = chatKeys.messages(ref);
      await queryClient.cancelQueries({ queryKey: messagesKey });
      const previousMessages =
        queryClient.getQueryData<ChatMessagesData>(messagesKey);
      const optimistic = createOptimisticMessage(content, "optimistic-message");

      queryClient.setQueryData<ChatMessagesData>(messagesKey, (old) =>
        old ? appendMessageToNewestPage(old, optimistic) : old,
      );

      return { messagesKey, previousMessages, optimisticId: optimistic.id };
    },
    onSuccess: (message, _variables, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData<ChatMessagesData>(context.messagesKey, (old) =>
        old ? replaceMessageInPages(old, context.optimisticId, message) : old,
      );
      if (ref) {
        void queryClient.invalidateQueries({
          queryKey: chatKeys.chatsOf(ref.accountId),
        });
      }
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
    (content: string) => mutateAsync({ content }),
    [mutateAsync],
  );

  return { sendMessage, isSending: isPending, isSupported };
};
