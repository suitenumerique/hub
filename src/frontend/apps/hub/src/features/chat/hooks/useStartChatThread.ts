import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatAttachment,
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
  replaceOrAppendThreadMessage,
  replaceRootMessageInPages,
  replyPreview,
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
  /** Replies the thread holds once this one is posted. */
  expectedReplyCount: number;
};

export type StartThreadCallbacks = {
  onOptimisticThread?: (threadId: string) => void;
  onCreated?: (threadId: string) => void;
};

export type StartThreadOptions = StartThreadCallbacks & {
  rootAuthor?: ChatMessageAuthor;
  /** Posts this uploaded file as the first reply; `content` is its caption. */
  attachment?: ChatAttachment;
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
    mutationFn: ({ rootMessage, content, options }) => {
      if (!isSupported) {
        throw new Error("Thread creation is not available.");
      }
      return getRegistry().get(ref.accountId).startChatThread({
        chatId: ref.chatId,
        rootMessageId: rootMessage.id,
        content,
        attachment: options?.attachment,
      });
    },
    onMutate: async ({ rootMessage, content, options }) => {
      const messagesKey: QueryKey = chatKeys.messages(ref);
      const threadsKey: QueryKey = chatKeys.threads(ref);
      const reply = createOptimisticMessage(
        content,
        "optimistic-thread-start",
        options?.attachment,
      );
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
      // Usually 1; more when a draft already started this thread with an
      // earlier message of the same submission.
      const replyCount = (previousRootThreadSummary?.replyCount ?? 0) + 1;
      const rootWithThread: ChatMessage = {
        ...rootMessage,
        thread: markOptimisticRootThreadSummary(
          { id: tempThreadId, replyCount, unreadCount: 0 },
          tempThreadId,
        ),
      };
      const thread: ChatThread = {
        id: tempThreadId,
        rootMessageId: rootMessage.id,
        author: currentUserAuthor,
        lastReplyAt: reply.timestamp,
        lastReplyPreview: replyPreview(reply),
        replyCount,
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
        expectedReplyCount: replyCount,
      };
    },
    onSuccess: (result, variables, context) => {
      if (!context) {
        return;
      }
      // The server snapshot can miss replies posted just before this one.
      const thread: ChatThread = {
        ...result.thread,
        replyCount: Math.max(
          result.thread.replyCount,
          context.expectedReplyCount,
        ),
      };
      queryClient.setQueryData<ChatMessagesData>(context.messagesKey, (old) =>
        old ? mergeRootThreadSummary(old, result.rootMessage.id, thread) : old,
      );
      queryClient.setQueryData<ChatThread[]>(context.threadsKey, (old) =>
        old
          ? upsertThread(removeThread(old, context.tempThreadId), thread)
          : [thread],
      );
      // A draft sending text then files starts the thread once, then each
      // next start replies in it: append to the detail already cached, whose
      // earlier replies the server snapshot may not include yet.
      queryClient.setQueryData<ChatThreadDetail>(
        chatKeys.thread(ref, result.thread.id),
        (old) =>
          old
            ? replaceOrAppendThreadMessage(
                old,
                result.message.id,
                result.message,
              )
            : result.threadDetail,
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
