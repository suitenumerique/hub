import { useQuery } from "@tanstack/react-query";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef, ChatThread } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

const EMPTY: ChatThread[] = [];

/**
 * Threads of a conversation with unread replies, for the unread banner. Unlike
 * {@link useChatThreads}, opening a conversation does not load its full thread
 * list: the threads panel does, as in Element.
 */
export const useChatUnreadThreads = (
  ref: ChatRef,
  { enabled = true }: { enabled?: boolean } = {},
): ChatThread[] => {
  const query = useQuery({
    queryKey: chatKeys.unreadThreads(ref),
    queryFn: () =>
      getRegistry().get(ref.accountId).getChatUnreadThreads(ref.chatId),
    enabled,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });
  return query.data ?? EMPTY;
};
