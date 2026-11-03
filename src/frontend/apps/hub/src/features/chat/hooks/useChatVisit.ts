import { useEffect } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef, ChatUnread } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";
import { useCachedQueryData } from "./useCachedQueryData";
import { useChatUnreadThreads } from "./useChatUnreadThreads";

/**
 * Records the visit of the open conversation, so that its thread replies no
 * longer show it unread in the list: those there when it opens, and those
 * received while it stays open. The threads keep their unread replies.
 */
export const useChatVisit = (ref: ChatRef, isOpen: boolean): void => {
  // Read without fetching: the conversation list owns this query.
  const accountUnread = useCachedQueryData<Record<string, ChatUnread>>(
    chatKeys.unreadOf(ref.accountId),
  );
  const isUnread = accountUnread?.[ref.chatId]?.unread ?? false;
  const unreadThreads = useChatUnreadThreads(ref, { enabled: isOpen });
  // Changes with each reply to an unread thread, not only with the list.
  const unreadThreadsKey = unreadThreads
    .map((thread) => `${thread.id}:${thread.unreadCount}`)
    .join(",");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    // Silent: the next change, or the next visit, writes it again.
    void getRegistry()
      .get(ref.accountId)
      .markChatVisited(ref.chatId)
      .catch(() => {});
  }, [isOpen, isUnread, ref.accountId, ref.chatId, unreadThreadsKey]);
};
