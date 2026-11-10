import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  beginThreadReplySend,
  confirmThreadReply,
  endThreadReplySend,
  holdThreadReply,
  releaseThreadReply,
} from "@/features/chat/pendingThreadReplies";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatAttachment,
  ChatComposedMessage,
  ChatMessage,
  ChatRef,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
  ChatThreadSummary,
} from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { chatKeys } from "../chatKeys";
import {
  createTransactionId,
  getFailedMessages,
  markMessageFailed,
  removeFailedMessage,
  trackSendingMessage,
} from "../composer/failedMessagesStore";
import { sendFailureMessage } from "../securityMessages";
import { reserveSendSlot, type SendSlot } from "../sendQueue";

import {
  appendThreadMessage,
  type ChatMessagesData,
  createCurrentUserThreadAuthor,
  createOptimisticMessage,
  getRootThreadSummary,
  isOptimisticThreadReplyId,
  mergeRootThreadSummary,
  OPTIMISTIC_THREAD_REPLY_PREFIX,
  patchRootThreadSummary,
  removeThread,
  removeThreadMessage,
  replaceOrAppendThreadMessage,
  replyPreview,
  rollbackOptimisticRootThreadSummary,
  upsertThread,
} from "./chatCompositionCache";
import { cancelReloads } from "./useChatEvents";
import { useChatThreadCompositionSupport } from "./useChatThreadCompositionSupport";

/** The thread's counters as this reply raised them, to undo if it fails. */
type ReplyCountPatch = {
  previousThreads: ChatThread[] | undefined;
  optimisticThreads: ChatThread[] | undefined;
  previousThreadListEntry: ChatThread | undefined;
  rootMessageId: string | null;
  previousRootThreadSummary: ChatThreadSummary | undefined;
  expectedReplyCount: number;
};

// TanStack copies the hook's options onto a mutation still pending, at every
// render: what a reply needs is fixed in its variables, as the thread on screen
// may have changed by its turn.
type SendThreadReplyVariables = {
  ref: ChatRef;
  threadId: string;
  message: ChatComposedMessage;
  /** Posts this uploaded file; `message` is then its caption. */
  attachment?: ChatAttachment;
  optimistic: ChatMessage;
  slot: SendSlot;
  transactionId: string;
  isSupported: boolean;
  /** Filled at its turn: see `raiseReplyCount`. */
  replyCount: { patch: ReplyCountPatch | null };
};

type SendThreadReplyContext = {
  threadKey: QueryKey;
  threadsKey: QueryKey;
  messagesKey: QueryKey;
  previousThread: ChatThreadDetail | undefined;
  optimisticThread: ChatThreadDetail | undefined;
};

export type UseSendChatThreadReplyResult = {
  /**
   * Queues a reply. Replies leave one at a time and in order; one that fails
   * stays in the thread. No need to wait for it.
   */
  sendReply: (
    message: ChatComposedMessage,
    attachment?: ChatAttachment,
  ) => Promise<ChatThreadMutationResult>;
  /** Queues a failed reply again. */
  retryFailedReply: (id: string) => void;
  /** Drops a failed reply for good. */
  discardFailedReply: (id: string) => void;
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

  /**
   * The bubble shows at once, but a reply only counts from its turn: the replies
   * before it are settled by then, so undoing it restores the exact counts.
   */
  const raiseReplyCount = async ({
    ref: targetRef,
    threadId: targetThreadId,
    optimistic,
    replyCount,
  }: SendThreadReplyVariables) => {
    const threadsKey: QueryKey = chatKeys.threads(targetRef);
    const messagesKey: QueryKey = chatKeys.messages(targetRef);
    await Promise.all([
      cancelReloads(queryClient, threadsKey),
      cancelReloads(queryClient, messagesKey),
    ]);
    const thread = queryClient.getQueryData<ChatThreadDetail>(
      chatKeys.thread(targetRef, targetThreadId),
    );
    const previousThreads = queryClient.getQueryData<ChatThread[]>(threadsKey);
    const previousMessages =
      queryClient.getQueryData<ChatMessagesData>(messagesKey);
    const previousThreadListEntry = previousThreads?.find(
      (candidate) => candidate.id === targetThreadId,
    );
    const rootMessageId =
      thread?.rootMessageId ?? previousThreadListEntry?.rootMessageId ?? null;
    const previousRootThreadSummary = rootMessageId
      ? getRootThreadSummary(previousMessages, rootMessageId)
      : undefined;
    // Without this reply and the ones queued behind it, and without the root.
    const confirmedRows = (thread?.messages ?? []).filter(
      ({ id }) => !isOptimisticThreadReplyId(id),
    ).length;
    const expectedReplyCount =
      Math.max(
        previousThreadListEntry?.replyCount ?? 0,
        confirmedRows - 1,
        previousRootThreadSummary?.replyCount ?? 0,
      ) + 1;

    queryClient.setQueryData<ChatThread[]>(threadsKey, (old) => {
      const current = old?.find((candidate) => candidate.id === targetThreadId);
      if (!old || !current) {
        return old;
      }
      return upsertThread(old, {
        ...current,
        author: currentUserAuthor,
        lastReplyAt: optimistic.timestamp,
        lastReplyPreview: replyPreview(optimistic),
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
                id: targetThreadId,
                replyCount: expectedReplyCount,
                unreadCount: 0,
              },
              optimistic.id,
            )
          : old,
      );
    }
    beginThreadReplySend(targetRef, targetThreadId);
    replyCount.patch = {
      previousThreads,
      optimisticThreads: queryClient.getQueryData<ChatThread[]>(threadsKey),
      previousThreadListEntry,
      rootMessageId,
      previousRootThreadSummary,
      expectedReplyCount,
    };
  };

  const { mutateAsync } = useMutation<
    ChatThreadMutationResult,
    Error,
    SendThreadReplyVariables,
    SendThreadReplyContext
  >({
    // Offline, the send fails and the reply says so, rather than wait unseen.
    networkMode: "always",
    mutationFn: async (variables) => {
      const {
        ref: targetRef,
        threadId: targetThreadId,
        message,
        attachment,
        slot,
        transactionId,
      } = variables;
      await slot.turn;
      if (!variables.isSupported) {
        throw new Error("Thread reply composition is not available.");
      }
      await raiseReplyCount(variables);
      return getRegistry()
        .get(targetRef.accountId)
        .sendChatThreadReply({
          ...message,
          chatId: targetRef.chatId,
          threadId: targetThreadId,
          attachment,
          transactionId,
        });
    },
    onMutate: async ({
      ref: targetRef,
      threadId: targetThreadId,
      optimistic,
    }) => {
      const threadKey: QueryKey = chatKeys.thread(targetRef, targetThreadId);
      await cancelReloads(queryClient, threadKey);
      const previousThread =
        queryClient.getQueryData<ChatThreadDetail>(threadKey);
      holdThreadReply(targetRef, targetThreadId, optimistic);
      queryClient.setQueryData<ChatThreadDetail>(threadKey, (old) =>
        old ? appendThreadMessage(old, optimistic) : old,
      );
      return {
        threadKey,
        threadsKey: chatKeys.threads(targetRef),
        messagesKey: chatKeys.messages(targetRef),
        previousThread,
        optimisticThread: queryClient.getQueryData<ChatThreadDetail>(threadKey),
      };
    },
    onSuccess: (
      result,
      { ref: targetRef, threadId: targetThreadId, optimistic, replyCount },
      context,
    ) => {
      removeFailedMessage(targetRef, targetThreadId, optimistic.id);
      if (!context) {
        return;
      }
      confirmThreadReply(
        targetRef,
        targetThreadId,
        optimistic.id,
        result.message,
      );
      const normalizedThread = {
        ...result.thread,
        replyCount: Math.max(
          result.thread.replyCount,
          replyCount.patch?.expectedReplyCount ?? 0,
        ),
      };
      queryClient.setQueryData<ChatThreadDetail>(context.threadKey, (old) =>
        old
          ? replaceOrAppendThreadMessage(old, optimistic.id, result.message)
          : result.threadDetail,
      );
      queryClient.setQueryData<ChatThread[]>(context.threadsKey, (old) => {
        if (!old) {
          return [normalizedThread];
        }
        const current = old.find(
          (candidate) => candidate.id === targetThreadId,
        );
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
        queryKey: chatKeys.chatsOf(targetRef.accountId),
      });
    },
    onError: (
      error,
      { ref: targetRef, threadId: targetThreadId, optimistic, replyCount },
      context,
    ) => {
      // First: its row takes over from the optimistic one, with the same id.
      markMessageFailed(targetRef, targetThreadId, optimistic.id);
      const failure = sendFailureMessage(
        error,
        t,
        t("Your message could not be sent. Please try again."),
      );
      // Several replies failing together show one toast, not a pile.
      notify.error(failure, { toastOptions: { toastId: failure } });
      if (!context) {
        return;
      }
      releaseThreadReply(targetRef, targetThreadId, optimistic.id);
      queryClient.setQueryData<ChatThreadDetail>(
        context.threadKey,
        (current) => {
          if (current === context.optimisticThread)
            return context.previousThread;
          if (!current) return current;
          return removeThreadMessage(current, optimistic.id);
        },
      );
      const patch = replyCount.patch;
      if (patch) {
        queryClient.setQueryData<ChatThread[]>(
          context.threadsKey,
          (current) => {
            if (current === patch.optimisticThreads) {
              return patch.previousThreads;
            }
            if (!current) {
              return current;
            }
            const optimisticEntry = current.find(
              (thread) =>
                thread.id === targetThreadId &&
                thread.lastReplyAt === optimistic.timestamp,
            );
            if (!optimisticEntry) {
              return current;
            }
            return patch.previousThreadListEntry
              ? upsertThread(current, {
                  ...optimisticEntry,
                  author: patch.previousThreadListEntry.author,
                  lastReplyAt: patch.previousThreadListEntry.lastReplyAt,
                  lastReplyPreview:
                    patch.previousThreadListEntry.lastReplyPreview,
                  replyCount: patch.previousThreadListEntry.replyCount,
                  unreadCount:
                    optimisticEntry.unreadCount === 0
                      ? patch.previousThreadListEntry.unreadCount
                      : optimisticEntry.unreadCount,
                })
              : removeThread(current, targetThreadId);
          },
        );
        queryClient.setQueryData<ChatMessagesData>(
          context.messagesKey,
          (current) =>
            current && patch.rootMessageId
              ? rollbackOptimisticRootThreadSummary(
                  current,
                  patch.rootMessageId,
                  optimistic.id,
                  patch.previousRootThreadSummary,
                )
              : current,
        );
      }
      void queryClient.invalidateQueries({ queryKey: context.threadKey });
      void queryClient.invalidateQueries({ queryKey: context.threadsKey });
      void queryClient.invalidateQueries({ queryKey: context.messagesKey });
    },
    onSettled: (
      _data,
      _error,
      { ref: targetRef, threadId: targetThreadId, slot, replyCount },
    ) => {
      // Raised only once its turn came: a reply refused before it never was.
      if (replyCount.patch) endThreadReplySend(targetRef, targetThreadId);
      slot.release();
    },
    meta: { noGlobalError: true },
  });

  /** Takes its place in the queue now, whatever the hook shows by its turn. */
  const send = useCallback(
    (
      message: ChatComposedMessage,
      attachment: ChatAttachment | undefined,
      transactionId: string,
    ) => {
      const optimistic = createOptimisticMessage(
        message,
        OPTIMISTIC_THREAD_REPLY_PREFIX,
        attachment,
      );
      trackSendingMessage(ref, threadId, {
        id: optimistic.id,
        message,
        attachment,
        timestamp: optimistic.timestamp,
        transactionId,
      });
      return mutateAsync({
        ref,
        threadId,
        message,
        attachment,
        optimistic,
        slot: reserveSendSlot(ref, threadId),
        transactionId,
        isSupported,
        replyCount: { patch: null },
      });
    },
    [isSupported, mutateAsync, ref, threadId],
  );

  const sendReply = useCallback(
    (message: ChatComposedMessage, attachment?: ChatAttachment) =>
      send(message, attachment, createTransactionId()),
    [send],
  );

  const retryFailedReply = useCallback(
    (id: string) => {
      const failed = getFailedMessages(ref, threadId).find(
        (candidate) => candidate.id === id,
      );
      if (!failed) {
        return;
      }
      removeFailedMessage(ref, threadId, id);
      // A new failure is reported by `onError`.
      void send(failed.message, failed.attachment, failed.transactionId).catch(
        () => {},
      );
    },
    [ref, send, threadId],
  );

  const discardFailedReply = useCallback(
    (id: string) => removeFailedMessage(ref, threadId, id),
    [ref, threadId],
  );

  return { sendReply, retryFailedReply, discardFailedReply, isSupported };
};
