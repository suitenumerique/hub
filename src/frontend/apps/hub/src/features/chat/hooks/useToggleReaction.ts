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

type ToggleContext = { queryKey: QueryKey; previous: unknown };

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
 * conversation bubble). The optimistic write and the mock driver reuse the same
 * `toggleReaction` helper, so the two never drift; a failed call rolls the
 * cache back to its pre-toggle snapshot.
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
      const queryKey: QueryKey = threadId
        ? chatKeys.thread(ref, threadId)
        : chatKeys.messages(ref);
      // Stop any in-flight refetch from overwriting the optimistic write.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      if (previous) {
        queryClient.setQueryData(
          queryKey,
          threadId
            ? applyThreadToggle(previous as ChatThreadDetail, messageId, emoji)
            : applyToggle(previous as ChatMessagesData, messageId, emoji),
        );
      }
      return { queryKey, previous };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    // Chat is fully mocked; a toggle failure is not user-actionable, so it is
    // handled by the rollback above rather than the global error surface.
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
