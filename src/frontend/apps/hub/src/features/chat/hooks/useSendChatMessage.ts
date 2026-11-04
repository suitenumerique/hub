import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatAttachment,
  ChatComposedMessage,
  ChatMessage,
  ChatRef,
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
  appendMessageToNewestPage,
  type ChatMessagesData,
  createOptimisticMessage,
  removeMessageFromPages,
  replaceMessageInPages,
} from "./chatCompositionCache";
import { useChatCompositionSupport } from "./useChatCompositionSupport";
import { cancelReloads, patchAcrossLoads } from "./useChatEvents";

// TanStack copies the hook's options onto a mutation still pending, at every
// render: what a send needs is fixed in its variables, never read from the hook.
type SendMessageVariables = {
  ref: ChatRef;
  /** The text, or the caption of `attachment` (usually empty). */
  message: ChatComposedMessage;
  /** Posts this uploaded file instead of a text message. */
  attachment?: ChatAttachment;
  optimistic: ChatMessage;
  slot: SendSlot;
  /** Set when a failure stays in the conversation, to send it again from there. */
  transactionId?: string;
};

type SendMessageContext = {
  messagesKey: QueryKey;
};

export type UseSendChatMessageResult = {
  /**
   * Queues a message in this conversation. Messages leave one at a time and in
   * order; one that fails stays in the conversation. No need to wait for it.
   */
  sendMessage: (message: ChatComposedMessage) => Promise<ChatMessage>;
  /** Sends to another conversation; a failure is left to the caller. */
  sendMessageTo: (
    ref: ChatRef,
    message: ChatComposedMessage,
    attachment?: ChatAttachment,
  ) => Promise<ChatMessage>;
  /** Queues an uploaded file, as `sendMessage` does. */
  sendAttachment: (attachment: ChatAttachment) => Promise<ChatMessage>;
  /** Queues a failed message again. */
  retryFailedMessage: (id: string) => void;
  /** Drops a failed message for good. */
  discardFailedMessage: (id: string) => void;
  isSupported: boolean;
};

export const useSendChatMessage = (
  ref: ChatRef | null,
): UseSendChatMessageResult => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const isSupported = useChatCompositionSupport(ref);

  const { mutateAsync } = useMutation<
    ChatMessage,
    Error,
    SendMessageVariables,
    SendMessageContext
  >({
    // Offline, the send fails and the message says so, rather than wait unseen.
    networkMode: "always",
    mutationFn: async ({
      ref: targetRef,
      message,
      attachment,
      slot,
      transactionId,
    }) => {
      await slot.turn;
      const driver = getRegistry().get(targetRef.accountId);
      if (!driver.supportsComposition) {
        throw new Error("Conversation message composition is not available.");
      }
      return driver.sendChatMessage({
        ...message,
        chatId: targetRef.chatId,
        attachment,
        transactionId,
      });
    },
    onMutate: async ({ ref: targetRef, optimistic }) => {
      const messagesKey: QueryKey = chatKeys.messages(targetRef);
      await cancelReloads(queryClient, messagesKey);
      queryClient.setQueryData<ChatMessagesData>(messagesKey, (old) =>
        old ? appendMessageToNewestPage(old, optimistic) : old,
      );
      return { messagesKey };
    },
    onSuccess: async (
      message,
      { ref: targetRef, optimistic, transactionId },
      context,
    ) => {
      if (transactionId) {
        removeFailedMessage(targetRef, undefined, optimistic.id);
      }
      if (!context) {
        return;
      }
      // A reconnect can refetch the room before /sync includes our send and
      // remove its optimistic row. Cancel that stale read, then retain the
      // confirmed event even when there is no optimistic row left to replace.
      // A first load still running may also have read the room before the
      // send: the event is added again once it lands.
      await cancelReloads(queryClient, context.messagesKey);
      patchAcrossLoads(queryClient, context.messagesKey, () =>
        queryClient.setQueryData<ChatMessagesData>(
          context.messagesKey,
          (old) => {
            if (!old) return old;
            if (
              old.pages.some((page) =>
                page.messages.some((row) => row.id === message.id),
              )
            ) {
              return removeMessageFromPages(old, optimistic.id);
            }
            if (
              old.pages.some((page) =>
                page.messages.some((row) => row.id === optimistic.id),
              )
            ) {
              return replaceMessageInPages(old, optimistic.id, message);
            }
            return old.pages[0]?.isAtLiveEnd === false
              ? old
              : appendMessageToNewestPage(old, message);
          },
        ),
      );
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(targetRef.accountId),
      });
    },
    onError: (
      error,
      { ref: targetRef, optimistic, transactionId },
      context,
    ) => {
      if (transactionId) {
        // First: its row takes over from the optimistic one, with the same id.
        markMessageFailed(targetRef, undefined, optimistic.id);
        const failure = sendFailureMessage(
          error,
          t,
          t("Your message could not be sent. Please try again."),
        );
        // Several messages failing together show one toast, not a pile.
        notify.error(failure, { toastOptions: { toastId: failure } });
      }
      if (context) {
        // Remove only this failed send. Restoring an earlier cache snapshot
        // would discard messages or decrypted content received in the meantime.
        queryClient.setQueryData<ChatMessagesData>(
          context.messagesKey,
          (old) => (old ? removeMessageFromPages(old, optimistic.id) : old),
        );
      }
    },
    onSettled: (_data, _error, { slot }) => slot.release(),
    meta: { noGlobalError: true },
  });

  /** Takes its place in the queue now, whatever the hook shows by its turn. */
  const send = useCallback(
    (
      targetRef: ChatRef,
      message: ChatComposedMessage,
      attachment: ChatAttachment | undefined,
      transactionId?: string,
    ) => {
      const optimistic = createOptimisticMessage(
        message,
        "optimistic-message",
        attachment,
      );
      if (transactionId) {
        trackSendingMessage(targetRef, undefined, {
          id: optimistic.id,
          message,
          attachment,
          timestamp: optimistic.timestamp,
          transactionId,
        });
      }
      return mutateAsync({
        ref: targetRef,
        message,
        attachment,
        optimistic,
        slot: reserveSendSlot(targetRef),
        transactionId,
      });
    },
    [mutateAsync],
  );

  const sendMessage = useCallback(
    (message: ChatComposedMessage) => {
      if (!ref) {
        return Promise.reject(
          new Error("Conversation message composition requires a chat."),
        );
      }
      return send(ref, message, undefined, createTransactionId());
    },
    [ref, send],
  );

  const sendMessageTo = useCallback(
    (
      targetRef: ChatRef,
      message: ChatComposedMessage,
      attachment?: ChatAttachment,
    ) => send(targetRef, message, attachment),
    [send],
  );

  const sendAttachment = useCallback(
    (attachment: ChatAttachment) => {
      if (!ref) {
        return Promise.reject(
          new Error("Sending an attachment requires a chat."),
        );
      }
      return send(ref, { content: "" }, attachment, createTransactionId());
    },
    [ref, send],
  );

  const retryFailedMessage = useCallback(
    (id: string) => {
      const failed =
        ref && getFailedMessages(ref).find((candidate) => candidate.id === id);
      if (!ref || !failed) {
        return;
      }
      removeFailedMessage(ref, undefined, id);
      // A new failure is reported by `onError`.
      void send(
        ref,
        failed.message,
        failed.attachment,
        failed.transactionId,
      ).catch(() => {});
    },
    [ref, send],
  );

  const discardFailedMessage = useCallback(
    (id: string) => {
      if (ref) {
        removeFailedMessage(ref, undefined, id);
      }
    },
    [ref],
  );

  return {
    sendMessage,
    sendMessageTo,
    sendAttachment,
    retryFailedMessage,
    discardFailedMessage,
    isSupported,
  };
};
