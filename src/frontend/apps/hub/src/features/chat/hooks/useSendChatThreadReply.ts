import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatRef,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import {
  appendThreadMessage,
  type ChatMessagesData,
  createCurrentUserThreadAuthor,
  createOptimisticMessage,
  patchRootThreadSummary,
  replaceRootMessageInPages,
  upsertThread,
} from "./chatCompositionCache";
import { useChatCompositionSupport } from "./useChatCompositionSupport";

type SendThreadReplyVariables = { content: string };

type SendThreadReplyContext = {
  threadKey: QueryKey;
  threadsKey: QueryKey;
  messagesKey: QueryKey;
  previousThread: ChatThreadDetail | undefined;
  previousThreads: ChatThread[] | undefined;
  previousMessages: ChatMessagesData | undefined;
};

export type UseSendChatThreadReplyResult = {
  sendReply: (content: string) => Promise<ChatThreadMutationResult>;
  isSending: boolean;
  isSupported: boolean;
};

export const useSendChatThreadReply = (
  ref: ChatRef,
  threadId: string,
): UseSendChatThreadReplyResult => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const isSupported = useChatCompositionSupport(ref);
  const currentUserAuthor = useMemo(
    () => createCurrentUserThreadAuthor(t),
    [t],
  );

  const { mutateAsync, isPending } = useMutation<
    ChatThreadMutationResult,
    Error,
    SendThreadReplyVariables,
    SendThreadReplyContext
  >({
    mutationFn: ({ content }) => {
      if (!isSupported) {
        throw new Error("Thread reply composition is not available.");
      }
      return getRegistry()
        .get(ref.accountId)
        .sendChatThreadReply({ chatId: ref.chatId, threadId, content });
    },
    onMutate: async ({ content }) => {
      const threadKey: QueryKey = chatKeys.thread(ref, threadId);
      const threadsKey: QueryKey = chatKeys.threads(ref);
      const messagesKey: QueryKey = chatKeys.messages(ref);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: threadKey }),
        queryClient.cancelQueries({ queryKey: threadsKey }),
        queryClient.cancelQueries({ queryKey: messagesKey }),
      ]);

      const previousThread =
        queryClient.getQueryData<ChatThreadDetail>(threadKey);
      const previousThreads =
        queryClient.getQueryData<ChatThread[]>(threadsKey);
      const previousMessages =
        queryClient.getQueryData<ChatMessagesData>(messagesKey);
      const optimistic = createOptimisticMessage(
        content,
        "optimistic-thread-reply",
      );
      const rootMessageId =
        previousThread?.rootMessageId ??
        previousThreads?.find((thread) => thread.id === threadId)
          ?.rootMessageId ??
        null;

      queryClient.setQueryData<ChatThreadDetail>(threadKey, (old) =>
        old ? appendThreadMessage(old, optimistic) : old,
      );
      queryClient.setQueryData<ChatThread[]>(threadsKey, (old) => {
        const current = old?.find((thread) => thread.id === threadId);
        if (!old || !current) {
          return old;
        }
        return upsertThread(old, {
          ...current,
          author: currentUserAuthor,
          lastReplyAt: optimistic.timestamp,
          lastReplyPreview: optimistic.content,
          replyCount: current.replyCount + 1,
          unreadCount: 0,
        });
      });
      if (rootMessageId) {
        queryClient.setQueryData<ChatMessagesData>(messagesKey, (old) =>
          old
            ? patchRootThreadSummary(old, rootMessageId, {
                id: threadId,
                replyCount:
                  (previousThreads?.find((thread) => thread.id === threadId)
                    ?.replyCount ??
                    Math.max(0, (previousThread?.messages.length ?? 1) - 1)) +
                  1,
                unreadCount: 0,
              })
            : old,
        );
      }

      return {
        threadKey,
        threadsKey,
        messagesKey,
        previousThread,
        previousThreads,
        previousMessages,
      };
    },
    onSuccess: (result, _variables, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData(context.threadKey, result.threadDetail);
      queryClient.setQueryData<ChatThread[]>(context.threadsKey, (old) =>
        old ? upsertThread(old, result.thread) : old,
      );
      queryClient.setQueryData<ChatMessagesData>(context.messagesKey, (old) =>
        old ? replaceRootMessageInPages(old, result.rootMessage) : old,
      );
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(ref.accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
    },
    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData(context.threadKey, context.previousThread);
      queryClient.setQueryData(context.threadsKey, context.previousThreads);
      queryClient.setQueryData(context.messagesKey, context.previousMessages);
    },
    meta: { noGlobalError: true },
  });

  const sendReply = useCallback(
    (content: string) => mutateAsync({ content }),
    [mutateAsync],
  );

  return { sendReply, isSending: isPending, isSupported };
};
