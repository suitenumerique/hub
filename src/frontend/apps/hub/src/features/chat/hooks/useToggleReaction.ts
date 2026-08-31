import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMessage,
  ChatRef,
  ChatThreadDetail,
} from "@/features/drivers/types";

import { chatKeys, type ChatMessageWindowQueryKey } from "../chatKeys";
import { emojiToCodepoints } from "../fluentEmoji";
import { toggleReaction } from "../reactions";

import {
  type ChatMessagesData,
  getMessageFromPages,
  updateMessageInPages,
  updateThreadMessage,
} from "./chatCompositionCache";

type ToggleVariables = { messageId: string; emoji: string };

type ReactionMutationMarker = object;

const optimisticReactionMarker = Symbol("optimistic-reaction");

type MarkedReactionMessage = ChatMessage & {
  [optimisticReactionMarker]?: ReactionMutationMarker;
};

type MessageWindowSnapshot = {
  queryKey: ChatMessageWindowQueryKey;
  previousMessage?: ChatMessage;
};

type ThreadSnapshot = {
  queryKey: QueryKey;
  previousMessage?: ChatMessage;
};

type ToggleContext = {
  marker: ReactionMutationMarker;
  messageId: string;
  messageWindows: MessageWindowSnapshot[];
  thread?: ThreadSnapshot;
};

const markOptimisticReaction = (
  message: ChatMessage,
  marker: ReactionMutationMarker,
): ChatMessage => {
  const marked = { ...message } as MarkedReactionMessage;
  // Non-enumerable on purpose: a driver event cloning the row clears the mark
  // and therefore wins over a late rollback from this mutation.
  Object.defineProperty(marked, optimisticReactionMarker, { value: marker });
  return marked;
};

const hasOptimisticReaction = (
  message: ChatMessage,
  marker: ReactionMutationMarker,
): boolean =>
  (message as MarkedReactionMessage)[optimisticReactionMarker] === marker;

const getOptimisticReactionMarker = (
  message: ChatMessage,
): ReactionMutationMarker | undefined =>
  (message as MarkedReactionMessage)[optimisticReactionMarker];

const toggleMessage = (
  message: ChatMessage,
  emoji: string,
  marker: ReactionMutationMarker,
): ChatMessage =>
  markOptimisticReaction(
    { ...message, reactions: toggleReaction(message.reactions, emoji) },
    marker,
  );

const rollbackReaction = (
  current: ChatMessage,
  previous: ChatMessage,
  marker: ReactionMutationMarker,
): ChatMessage =>
  hasOptimisticReaction(current, marker)
    ? { ...current, reactions: previous.reactions }
    : current;

const confirmReaction = (
  current: ChatMessage,
  confirmed: ChatMessage,
  emoji: string,
  marker: ReactionMutationMarker,
): ChatMessage => {
  const currentMarker = getOptimisticReactionMarker(current);
  if (currentMarker && currentMarker !== marker) {
    return current;
  }
  const key = emojiToCodepoints(emoji);
  const reactedByMe = (message: ChatMessage) =>
    message.reactions.find(
      (reaction) => emojiToCodepoints(reaction.emoji) === key,
    )?.reactedByMe ?? false;
  return reactedByMe(current) === reactedByMe(confirmed)
    ? { ...current }
    : { ...current, reactions: toggleReaction(current.reactions, emoji) };
};

export type UseToggleReactionResult = {
  /** Toggles the current user's reaction with `emoji` on a message. */
  toggle: (messageId: string, emoji: string) => void;
};

/**
 * Toggles a reaction through the driver with an optimistic cache update. When
 * `threadId` is set the update targets the thread detail; otherwise it targets
 * both main-timeline windows. A failed call restores only the reaction field
 * still carrying this mutation's marker.
 */
export const useToggleReaction = (
  ref: ChatRef,
  threadId?: string,
): UseToggleReactionResult => {
  const queryClient = useQueryClient();

  const { mutate } = useMutation<
    ChatMessage,
    Error,
    ToggleVariables,
    ToggleContext
  >({
    mutationFn: ({ messageId, emoji }) => {
      const driver = getRegistry().get(ref.accountId);
      return threadId
        ? driver.toggleChatThreadReaction({
            chatId: ref.chatId,
            threadId,
            messageId,
            emoji,
          })
        : driver.toggleChatReaction({ chatId: ref.chatId, messageId, emoji });
    },
    onMutate: async ({ messageId, emoji }) => {
      const messageWindowKeys =
        !threadId || messageId === threadId
          ? [...chatKeys.messageWindows(ref)]
          : [];
      const threadKey = threadId ? chatKeys.thread(ref, threadId) : undefined;
      // Stop any in-flight refetch from overwriting the optimistic write.
      await Promise.all([
        ...messageWindowKeys.map((queryKey) =>
          queryClient.cancelQueries({ queryKey, exact: true }),
        ),
        ...(threadKey
          ? [queryClient.cancelQueries({ queryKey: threadKey, exact: true })]
          : []),
      ]);
      const marker: ReactionMutationMarker = {};
      const messageWindows = messageWindowKeys.map((queryKey) => ({
        queryKey,
        previousMessage: getMessageFromPages(
          queryClient.getQueryData<ChatMessagesData>(queryKey),
          messageId,
        ),
      }));
      const thread = threadKey
        ? {
            queryKey: threadKey,
            previousMessage: queryClient
              .getQueryData<ChatThreadDetail>(threadKey)
              ?.messages.find((message) => message.id === messageId),
          }
        : undefined;

      messageWindows.forEach(({ queryKey }) => {
        queryClient.setQueryData<ChatMessagesData>(queryKey, (data) => {
          return data
            ? updateMessageInPages(data, messageId, (current) =>
                toggleMessage(current, emoji, marker),
              )
            : data;
        });
      });
      if (threadKey) {
        queryClient.setQueryData<ChatThreadDetail>(threadKey, (detail) => {
          return detail
            ? updateThreadMessage(detail, messageId, (current) =>
                toggleMessage(current, emoji, marker),
              )
            : detail;
        });
      }
      return {
        marker,
        messageId,
        messageWindows,
        ...(thread ? { thread } : {}),
      };
    },
    onSuccess: (message, { emoji }, context) => {
      context.messageWindows.forEach(({ queryKey }) => {
        queryClient.setQueryData<ChatMessagesData>(queryKey, (data) =>
          data
            ? updateMessageInPages(data, message.id, (current) =>
                confirmReaction(current, message, emoji, context.marker),
              )
            : data,
        );
      });
      if (context.thread) {
        queryClient.setQueryData<ChatThreadDetail>(
          context.thread.queryKey,
          (detail) =>
            detail
              ? updateThreadMessage(detail, message.id, (current) =>
                  confirmReaction(current, message, emoji, context.marker),
                )
              : detail,
        );
      }
    },
    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }
      context.messageWindows.forEach(({ queryKey, previousMessage }) => {
        if (!previousMessage) {
          return;
        }
        queryClient.setQueryData<ChatMessagesData>(queryKey, (data) => {
          return data
            ? updateMessageInPages(data, context.messageId, (current) =>
                rollbackReaction(current, previousMessage, context.marker),
              )
            : data;
        });
      });
      if (context.thread?.previousMessage) {
        const { previousMessage, queryKey } = context.thread;
        queryClient.setQueryData<ChatThreadDetail>(queryKey, (detail) => {
          return detail
            ? updateThreadMessage(detail, context.messageId, (current) =>
                rollbackReaction(current, previousMessage, context.marker),
              )
            : detail;
        });
      }
    },
    // A toggle failure is handled by the rollback above rather than the global
    // error surface.
    meta: { noGlobalError: true },
  });

  const toggle = useCallback(
    (messageId: string, emoji: string) => {
      mutate({ messageId, emoji });
    },
    [mutate],
  );

  return { toggle };
};
