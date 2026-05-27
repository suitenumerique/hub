import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { getDriver } from "@/features/config/Config";
import type { ChatMessagesPage } from "@/features/drivers/types";

import { toggleReaction } from "../reactions";

type ChatMessagesData = InfiniteData<ChatMessagesPage>;

type ToggleVariables = { messageId: string; emoji: string };

type ToggleContext = { previous: ChatMessagesData | undefined };

/** Builds the react-query key for a chat's paginated message history. */
const messagesQueryKey = (chatId: string) => ["chat-messages", chatId];

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

export type UseToggleReactionResult = {
  /** Toggles the current user's reaction with `emoji` on a message. */
  toggle: (messageId: string, emoji: string) => void;
};

/**
 * Toggles a reaction through the driver with an optimistic update of the
 * `["chat-messages", chatId]` cache. The optimistic write and the mock driver
 * both reuse the same `toggleReaction` helper, so the two never drift; a failed
 * call rolls the cache back to its pre-toggle snapshot.
 */
export const useToggleReaction = (chatId: string): UseToggleReactionResult => {
  const driver = getDriver();
  const queryClient = useQueryClient();

  const { mutate } = useMutation<
    unknown,
    Error,
    ToggleVariables,
    ToggleContext
  >({
    mutationFn: ({ messageId, emoji }) =>
      driver.toggleChatReaction({ chatId, messageId, emoji }),
    onMutate: async ({ messageId, emoji }) => {
      const queryKey = messagesQueryKey(chatId);
      // Stop any in-flight refetch from overwriting the optimistic write.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ChatMessagesData>(queryKey);
      if (previous) {
        queryClient.setQueryData<ChatMessagesData>(
          queryKey,
          applyToggle(previous, messageId, emoji),
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(messagesQueryKey(chatId), context.previous);
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
