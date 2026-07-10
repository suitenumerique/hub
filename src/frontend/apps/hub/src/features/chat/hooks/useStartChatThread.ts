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
  getRootThreadSummary,
  markOptimisticRootThreadSummary,
  mergeRootThreadSummary,
  OPTIMISTIC_THREAD_ID_PREFIX,
  removeThread,
  replaceRootMessageInPages,
  rollbackOptimisticRootThreadSummary,
  upsertThread,
} from "./chatCompositionCache";
import { useChatThreadCompositionSupport } from "./useChatThreadCompositionSupport";

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
  previousThreads: ChatThread[] | undefined;
  optimisticThreads: ChatThread[] | undefined;
  rootMessageId: string;
  previousRootThreadSummary: ChatMessage["thread"];
  optimisticRootThreadMarker: string;
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
  const isSupported = useChatThreadCompositionSupport(ref);
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
      const tempThreadId = `${OPTIMISTIC_THREAD_ID_PREFIX}${reply.id}`;
      const tempThreadKey: QueryKey = chatKeys.thread(ref, tempThreadId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: messagesKey }),
        queryClient.cancelQueries({ queryKey: threadsKey }),
      ]);

      const previousMessages =
        queryClient.getQueryData<ChatMessagesData>(messagesKey);
      const previousThreads =
        queryClient.getQueryData<ChatThread[]>(threadsKey);
      const previousRootThreadSummary = getRootThreadSummary(
        previousMessages,
        rootMessage.id,
      );
      const rootWithThread: ChatMessage = {
        ...rootMessage,
        thread: markOptimisticRootThreadSummary(
          { id: tempThreadId, replyCount: 1, unreadCount: 0 },
          tempThreadId,
        ),
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

      const optimisticThreads =
        queryClient.getQueryData<ChatThread[]>(threadsKey);

      return {
        messagesKey,
        threadsKey,
        tempThreadKey,
        tempThreadId,
        previousThreads,
        optimisticThreads,
        rootMessageId: rootMessage.id,
        previousRootThreadSummary,
        optimisticRootThreadMarker: tempThreadId,
      };
    },
    onSuccess: (result, variables, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData<ChatMessagesData>(context.messagesKey, (old) =>
        old
          ? mergeRootThreadSummary(old, result.rootMessage.id, result.thread)
          : old,
      );
      queryClient.setQueryData<ChatThread[]>(context.threadsKey, (old) =>
        old
          ? upsertThread(removeThread(old, context.tempThreadId), result.thread)
          : [result.thread],
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
      queryClient.setQueryData<ChatMessagesData>(
        context.messagesKey,
        (current) =>
          current
            ? rollbackOptimisticRootThreadSummary(
                current,
                context.rootMessageId,
                context.optimisticRootThreadMarker,
                context.previousRootThreadSummary,
              )
            : current,
      );
      queryClient.setQueryData<ChatThread[]>(context.threadsKey, (current) =>
        current === context.optimisticThreads
          ? context.previousThreads
          : current
            ? removeThread(current, context.tempThreadId)
            : current,
      );
      queryClient.removeQueries({
        queryKey: context.tempThreadKey,
        exact: true,
      });
      void queryClient.invalidateQueries({ queryKey: context.messagesKey });
      void queryClient.invalidateQueries({ queryKey: context.threadsKey });
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
