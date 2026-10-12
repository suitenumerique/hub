import {
  type InfiniteData,
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatRef,
  ChatMessagesPage,
  ChatThreadDetail,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";
import { toggleReaction } from "../reactions";

type ChatMessagesData = InfiniteData<ChatMessagesPage>;

type ToggleVariables = { messageId: string; emoji: string };

type CacheSnapshot = { queryKey: QueryKey; previous: unknown };

type ToggleContext = { snapshots: CacheSnapshot[] };

/**
 * Applies the reaction toggle to every loaded page, producing fresh
 * `ChatMessage` objects only for the touched message so the memoized
 * virtual-list row re-renders. A no-op for pages that do not hold the message.
 */
const applyToggle = (
  data: ChatMessagesData,
  messageId: string,
  emoji: string,
): ChatMessagesData => ({
  ...data,
  pages: data.pages.map((page) => {
    if (!page.messages.some((message) => message.id === messageId)) {
      return page;
    }
    return {
      ...page,
      messages: page.messages.map((message) =>
        message.id === messageId
          ? { ...message, reactions: toggleReaction(message.reactions, emoji) }
          : message,
      ),
    };
  }),
});

/**
 * Applies the reaction toggle to a thread's loaded detail, producing a fresh
 * `ChatMessage` for the touched message so the thread bubble re-renders.
 */
const applyThreadToggle = (
  detail: ChatThreadDetail,
  messageId: string,
  emoji: string,
): ChatThreadDetail => ({
  ...detail,
  messages: detail.messages.map((message) =>
    message.id === messageId
      ? { ...message, reactions: toggleReaction(message.reactions, emoji) }
      : message,
  ),
});

export type UseToggleReactionResult = {
  /** Toggles the current user's reaction with `emoji` on a message. */
  toggle: (messageId: string, emoji: string) => void;
};

/**
 * Toggles a reaction through the driver with an optimistic cache update. When
 * `threadId` is set the update targets the `["chat-thread", chatId, threadId]`
 * cache (a thread bubble); otherwise the `["chat-messages", chatId]` cache (a
 * conversation bubble). A thread root shows in both, so both are updated. A
 * failed call rolls the caches back to their pre-toggle snapshots.
 */
export const useToggleReaction = (
  ref: ChatRef,
  threadId?: string,
): UseToggleReactionResult => {
  const queryClient = useQueryClient();

  const { mutate } = useMutation<
    unknown,
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
      // Main bubbles update the conversation, plus the thread detail they root
      // when it is loaded. Thread bubbles update their detail, plus the
      // conversation when the bubble is the root.
      const targets: Array<{
        queryKey: QueryKey;
        apply: (previous: unknown) => unknown;
      }> = [];
      if (!threadId || messageId === threadId) {
        targets.push({
          queryKey: chatKeys.messages(ref),
          apply: (previous) =>
            applyToggle(previous as ChatMessagesData, messageId, emoji),
        });
      }
      targets.push({
        queryKey: chatKeys.thread(ref, threadId ?? messageId),
        apply: (previous) =>
          applyThreadToggle(previous as ChatThreadDetail, messageId, emoji),
      });

      const snapshots: CacheSnapshot[] = [];
      for (const { queryKey, apply } of targets) {
        // Stop any in-flight refetch from overwriting the optimistic write.
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData(queryKey);
        if (previous) {
          queryClient.setQueryData(queryKey, apply(previous));
          snapshots.push({ queryKey, previous });
        }
      }
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      context?.snapshots.forEach(({ queryKey, previous }) => {
        queryClient.setQueryData(queryKey, previous);
      });
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
