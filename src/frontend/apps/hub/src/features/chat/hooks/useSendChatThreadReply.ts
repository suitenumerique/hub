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
  ChatThreadSummary,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import {
  appendThreadMessage,
  type ChatMessagesData,
  createCurrentUserThreadAuthor,
  createOptimisticMessage,
  getRootThreadSummary,
  mergeRootThreadSummary,
  patchRootThreadSummary,
  removeThread,
  removeThreadMessage,
  replaceOrAppendThreadMessage,
  rollbackOptimisticRootThreadSummary,
  upsertThread,
} from "./chatCompositionCache";
import { useChatThreadCompositionSupport } from "./useChatThreadCompositionSupport";

type SendThreadReplyVariables = { content: string };

type SendThreadReplyContext = {
  threadKey: QueryKey;
  threadsKey: QueryKey;
  messagesKey: QueryKey;
  previousThread: ChatThreadDetail | undefined;
  previousThreads: ChatThread[] | undefined;
  optimisticThread: ChatThreadDetail | undefined;
  optimisticThreads: ChatThread[] | undefined;
  optimisticMessageId: string;
  optimisticTimestamp: string;
  previousThreadListEntry: ChatThread | undefined;
  rootMessageId: string | null;
  previousRootThreadSummary: ChatThreadSummary | undefined;
  optimisticRootThreadMarker: string;
  expectedReplyCount: number;
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
  const isSupported = useChatThreadCompositionSupport(ref);
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
      const previousThreadListEntry = previousThreads?.find(
        (thread) => thread.id === threadId,
      );
      const rootMessageId =
        previousThread?.rootMessageId ??
        previousThreadListEntry?.rootMessageId ??
        null;
      const previousRootReplyCount = rootMessageId
        ? getRootThreadSummary(previousMessages, rootMessageId)?.replyCount
        : undefined;
      const previousRootThreadSummary = rootMessageId
        ? getRootThreadSummary(previousMessages, rootMessageId)
        : undefined;
      const expectedReplyCount =
        Math.max(
          previousThreadListEntry?.replyCount ?? 0,
          Math.max(0, (previousThread?.messages.length ?? 1) - 1),
          previousRootReplyCount ?? 0,
        ) + 1;

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
          replyCount: Math.max(current.replyCount + 1, expectedReplyCount),
          unreadCount: 0,
        });
      });
      if (rootMessageId) {
        queryClient.setQueryData<ChatMessagesData>(messagesKey, (old) =>
          old
            ? patchRootThreadSummary(
                old,
                rootMessageId,
                {
                  id: threadId,
                  replyCount: expectedReplyCount,
                  unreadCount: 0,
                },
                optimistic.id,
              )
            : old,
        );
      }

      const optimisticThread =
        queryClient.getQueryData<ChatThreadDetail>(threadKey);
      const optimisticThreads =
        queryClient.getQueryData<ChatThread[]>(threadsKey);
      return {
        threadKey,
        threadsKey,
        messagesKey,
        previousThread,
        previousThreads,
        optimisticThread,
        optimisticThreads,
        optimisticMessageId: optimistic.id,
        optimisticTimestamp: optimistic.timestamp,
        previousThreadListEntry,
        rootMessageId,
        previousRootThreadSummary,
        optimisticRootThreadMarker: optimistic.id,
        expectedReplyCount,
      };
    },
    onSuccess: (result, _variables, context) => {
      if (!context) {
        return;
      }
      const normalizedThread = {
        ...result.thread,
        replyCount: Math.max(
          result.thread.replyCount,
          context.expectedReplyCount,
        ),
      };
      queryClient.setQueryData<ChatThreadDetail>(context.threadKey, (old) =>
        old
          ? replaceOrAppendThreadMessage(
              old,
              context.optimisticMessageId,
              result.message,
            )
          : result.threadDetail,
      );
      queryClient.setQueryData<ChatThread[]>(context.threadsKey, (old) => {
        if (!old) {
          return [normalizedThread];
        }
        const current = old.find((thread) => thread.id === threadId);
        const newest =
          current && current.lastReplyAt > normalizedThread.lastReplyAt
            ? current
            : normalizedThread;
        return upsertThread(old, {
          ...newest,
          replyCount: Math.max(
            current?.replyCount ?? 0,
            normalizedThread.replyCount,
          ),
          unreadCount: Math.max(
            current?.unreadCount ?? 0,
            normalizedThread.unreadCount,
          ),
        });
      });
      queryClient.setQueryData<ChatMessagesData>(context.messagesKey, (old) =>
        old
          ? mergeRootThreadSummary(old, result.rootMessage.id, normalizedThread)
          : old,
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
      queryClient.setQueryData<ChatThreadDetail>(
        context.threadKey,
        (current) =>
          current === context.optimisticThread
            ? context.previousThread
            : current
              ? removeThreadMessage(current, context.optimisticMessageId)
              : current,
      );
      queryClient.setQueryData<ChatThread[]>(context.threadsKey, (current) => {
        if (current === context.optimisticThreads) {
          return context.previousThreads;
        }
        if (!current) {
          return current;
        }
        const optimisticEntry = current.find(
          (thread) =>
            thread.id === threadId &&
            thread.lastReplyAt === context.optimisticTimestamp,
        );
        if (!optimisticEntry) {
          return current;
        }
        return context.previousThreadListEntry
          ? upsertThread(current, {
              ...optimisticEntry,
              author: context.previousThreadListEntry.author,
              lastReplyAt: context.previousThreadListEntry.lastReplyAt,
              lastReplyPreview:
                context.previousThreadListEntry.lastReplyPreview,
              replyCount: context.previousThreadListEntry.replyCount,
              unreadCount:
                optimisticEntry.unreadCount === 0
                  ? context.previousThreadListEntry.unreadCount
                  : optimisticEntry.unreadCount,
            })
          : removeThread(current, threadId);
      });
      queryClient.setQueryData<ChatMessagesData>(
        context.messagesKey,
        (current) =>
          current && context.rootMessageId
            ? rollbackOptimisticRootThreadSummary(
                current,
                context.rootMessageId,
                context.optimisticRootThreadMarker,
                context.previousRootThreadSummary,
              )
            : current,
      );
      void queryClient.invalidateQueries({ queryKey: context.threadKey });
      void queryClient.invalidateQueries({ queryKey: context.threadsKey });
      void queryClient.invalidateQueries({ queryKey: context.messagesKey });
    },
    meta: { noGlobalError: true },
  });

  const sendReply = useCallback(
    (content: string) => mutateAsync({ content }),
    [mutateAsync],
  );

  return { sendReply, isSending: isPending, isSupported };
};
