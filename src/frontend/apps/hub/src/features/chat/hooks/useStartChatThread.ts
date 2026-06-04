import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatRef,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import {
  type ChatMessagesData,
  createCurrentUserThreadAuthor,
  createOptimisticMessage,
  removeThread,
  replaceRootMessageInPages,
  upsertThread,
} from "./chatCompositionCache";
import { useChatCompositionSupport } from "./useChatCompositionSupport";

type StartThreadVariables = {
  rootMessage: ChatMessage;
  content: string;
  options?: StartThreadOptions;
};

type StartThreadContext = {
  messagesKey: QueryKey;
  threadsKey: QueryKey;
  tempThreadKey: QueryKey;
  tempThreadId: string;
  previousMessages: ChatMessagesData | undefined;
  previousThreads: ChatThread[] | undefined;
};

export type StartThreadCallbacks = {
  onOptimisticThread?: (threadId: string) => void;
  onCreated?: (threadId: string) => void;
};

export type StartThreadOptions = StartThreadCallbacks & {
  rootAuthor?: ChatMessageAuthor;
};

export type UseStartChatThreadResult = {
  startThread: (
    rootMessage: ChatMessage,
    content: string,
    options?: StartThreadOptions,
  ) => Promise<ChatThreadMutationResult>;
  isStarting: boolean;
  isSupported: boolean;
};

export const useStartChatThread = (ref: ChatRef): UseStartChatThreadResult => {
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
    StartThreadVariables,
    StartThreadContext
  >({
    mutationFn: ({ rootMessage, content }) => {
      if (!isSupported) {
        throw new Error("Thread creation is not available.");
      }
      return getRegistry().get(ref.accountId).startChatThread({
        chatId: ref.chatId,
        rootMessageId: rootMessage.id,
        content,
      });
    },
    onMutate: async ({ rootMessage, content, options }) => {
      const messagesKey: QueryKey = chatKeys.messages(ref);
      const threadsKey: QueryKey = chatKeys.threads(ref);
      const reply = createOptimisticMessage(content, "optimistic-thread-start");
      const tempThreadId = `optimistic-thread-${reply.id}`;
      const tempThreadKey: QueryKey = chatKeys.thread(ref, tempThreadId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: messagesKey }),
        queryClient.cancelQueries({ queryKey: threadsKey }),
      ]);

      const previousMessages =
        queryClient.getQueryData<ChatMessagesData>(messagesKey);
      const previousThreads =
        queryClient.getQueryData<ChatThread[]>(threadsKey);
      const rootWithThread: ChatMessage = {
        ...rootMessage,
        thread: { id: tempThreadId, replyCount: 1, unreadCount: 0 },
      };
      const thread: ChatThread = {
        id: tempThreadId,
        rootMessageId: rootMessage.id,
        author: currentUserAuthor,
        lastReplyAt: reply.timestamp,
        lastReplyPreview: reply.content,
        replyCount: 1,
        unreadCount: 0,
      };
      const detail: ChatThreadDetail = {
        id: tempThreadId,
        rootMessageId: rootMessage.id,
        messages: [rootWithThread, reply],
        authors:
          rootMessage.authorId === "me" || !options?.rootAuthor
            ? []
            : [options.rootAuthor],
        firstUnreadIndex: null,
      };

      queryClient.setQueryData<ChatMessagesData>(messagesKey, (old) =>
        old ? replaceRootMessageInPages(old, rootWithThread) : old,
      );
      queryClient.setQueryData<ChatThread[]>(threadsKey, (old) =>
        old ? upsertThread(old, thread) : old,
      );
      queryClient.setQueryData(tempThreadKey, detail);
      options?.onOptimisticThread?.(tempThreadId);

      return {
        messagesKey,
        threadsKey,
        tempThreadKey,
        tempThreadId,
        previousMessages,
        previousThreads,
      };
    },
    onSuccess: (result, variables, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData<ChatMessagesData>(context.messagesKey, (old) =>
        old ? replaceRootMessageInPages(old, result.rootMessage) : old,
      );
      queryClient.setQueryData<ChatThread[]>(context.threadsKey, (old) =>
        old
          ? upsertThread(removeThread(old, context.tempThreadId), result.thread)
          : old,
      );
      queryClient.setQueryData(
        chatKeys.thread(ref, result.thread.id),
        result.threadDetail,
      );
      queryClient.removeQueries({
        queryKey: context.tempThreadKey,
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(ref.accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
      variables.options?.onCreated?.(result.thread.id);
    },
    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData(context.messagesKey, context.previousMessages);
      queryClient.setQueryData(context.threadsKey, context.previousThreads);
      queryClient.removeQueries({
        queryKey: context.tempThreadKey,
        exact: true,
      });
    },
    meta: { noGlobalError: true },
  });

  const startThread = useCallback(
    (rootMessage: ChatMessage, content: string, options?: StartThreadOptions) =>
      mutateAsync({ rootMessage, content, options }),
    [mutateAsync],
  );

  return { startThread, isStarting: isPending, isSupported };
};
