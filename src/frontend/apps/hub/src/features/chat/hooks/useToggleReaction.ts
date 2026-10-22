import {
  type InfiniteData,
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMessage,
  ChatReaction,
  ChatRef,
  ChatMessagesPage,
  ChatThreadDetail,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";
import {
  beginReactionToggle,
  endReactionToggle,
} from "../pendingReactionToggles";
import { keepReactionOrder, toggleReaction } from "../reactions";

type ChatMessagesData = InfiniteData<ChatMessagesPage>;

type ToggleVariables = { messageId: string; emoji: string };

type ReactionsUpdate = (reactions: ChatReaction[]) => ChatReaction[];

/** A cache showing the message, and how to update the message's reactions. */
type ReactionCache = {
  queryKey: QueryKey;
  update: (data: unknown, update: ReactionsUpdate) => unknown;
};

/** The message's reactions in one cache before the toggle. */
type ReactionSnapshot = ReactionCache & { reactions: ChatReaction[] };

type ToggleContext = { snapshots: ReactionSnapshot[] };

/**
 * Updates one message's reactions in every loaded page, producing a fresh
 * `ChatMessage` only for it so the memoized virtual-list row re-renders. A
 * no-op for pages that do not hold the message.
 */
const updatePageReactions = (
  data: ChatMessagesData,
  messageId: string,
  update: ReactionsUpdate,
): ChatMessagesData => ({
  ...data,
  pages: data.pages.map((page) =>
    page.messages.some((message) => message.id === messageId)
      ? {
          ...page,
          messages: page.messages.map((message) =>
            message.id === messageId
              ? { ...message, reactions: update(message.reactions) }
              : message,
          ),
        }
      : page,
  ),
});

/** Updates one message's reactions in a thread's loaded detail. */
const updateThreadReactions = (
  detail: ChatThreadDetail,
  messageId: string,
  update: ReactionsUpdate,
): ChatThreadDetail => ({
  ...detail,
  messages: detail.messages.map((message) =>
    message.id === messageId
      ? { ...message, reactions: update(message.reactions) }
      : message,
  ),
});

const reactionsIn = (
  data: unknown,
  messageId: string,
): ChatReaction[] | undefined => {
  const messages =
    (data as ChatMessagesData).pages?.flatMap((page) => page.messages) ??
    (data as ChatThreadDetail).messages;
  return messages?.find((message) => message.id === messageId)?.reactions;
};

export type UseToggleReactionResult = {
  /** Toggles the current user's reaction with `emoji` on a message. */
  toggle: (messageId: string, emoji: string) => void;
};

/**
 * Toggles a reaction through the driver with an optimistic cache update. When
 * `threadId` is set the update targets the `["chat-thread", chatId, threadId]`
 * cache (a thread bubble); otherwise the `["chat-messages", chatId]` cache (a
 * conversation bubble). A thread root shows in both, so both are updated. A
 * failed call puts this message's reactions back as they were.
 */
export const useToggleReaction = (
  ref: ChatRef,
  threadId?: string,
): UseToggleReactionResult => {
  const queryClient = useQueryClient();

  // Main bubbles update the conversation, plus the thread detail they root
  // when it is loaded. Thread bubbles update their detail, plus the
  // conversation when the bubble is the root.
  const cachesOf = useCallback(
    (messageId: string) => {
      const caches: ReactionCache[] = [];
      if (!threadId || messageId === threadId) {
        caches.push({
          queryKey: chatKeys.messages(ref),
          update: (data, update) =>
            updatePageReactions(data as ChatMessagesData, messageId, update),
        });
      }
      caches.push({
        queryKey: chatKeys.thread(ref, threadId ?? messageId),
        update: (data, update) =>
          updateThreadReactions(data as ChatThreadDetail, messageId, update),
      });
      return caches;
    },
    [ref, threadId],
  );

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
      // From now on, nothing read before the toggle overwrites its chips.
      beginReactionToggle(ref, messageId);
      const snapshots: ReactionSnapshot[] = [];
      for (const cache of cachesOf(messageId)) {
        // Stop any in-flight refetch from overwriting the optimistic write.
        await queryClient.cancelQueries({ queryKey: cache.queryKey });
        const data = queryClient.getQueryData(cache.queryKey);
        const reactions = data ? reactionsIn(data, messageId) : undefined;
        if (data && reactions) {
          queryClient.setQueryData(
            cache.queryKey,
            cache.update(data, (current) => toggleReaction(current, emoji)),
          );
          snapshots.push({ ...cache, reactions });
        }
      }
      return { snapshots };
    },
    // The driver answers with the reactions the homeserver ends with.
    onSuccess: (message) => {
      for (const { queryKey, update } of cachesOf(message.id)) {
        queryClient.setQueryData(queryKey, (data: unknown) =>
          data
            ? update(data, (current) =>
                keepReactionOrder(current, message.reactions),
              )
            : data,
        );
      }
    },
    // Only this message's reactions go back: the rest of the cache may have
    // changed meanwhile, other toggles included.
    onError: (_error, _variables, context) => {
      context?.snapshots.forEach(({ queryKey, update, reactions }) => {
        queryClient.setQueryData(queryKey, (data: unknown) =>
          data ? update(data, () => reactions) : data,
        );
      });
    },
    onSettled: (_message, _error, { messageId }) => {
      endReactionToggle(ref, messageId);
    },
    // A toggle failure is handled by the rollback above rather than the global
    // error surface.
    meta: { noGlobalError: true },
    // The driver picks add or remove from the homeserver state, so a quick
    // second click must wait for the first write. Optimistic updates stay
    // immediate: `onMutate` runs before the scope queue.
    scope: { id: `reaction-toggle:${ref.accountId}:${ref.chatId}` },
  });

  const toggle = useCallback(
    (messageId: string, emoji: string) => {
      mutate({ messageId, emoji });
    },
    [mutate],
  );

  return { toggle };
};
