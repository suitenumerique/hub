import { useEffect } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";

/**
 * While the conversation is open, its thread replies no longer show it unread
 * in the list. The threads keep them unread. Silent: a failed write only means
 * the dot comes back, until the next visit.
 */
export const useChatVisit = (ref: ChatRef, isOpen: boolean): void => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const driver = getRegistry().get(ref.accountId);
    void driver.startChatVisit(ref.chatId).catch(() => {});
    return () => {
      void driver.endChatVisit(ref.chatId).catch(() => {});
    };
  }, [isOpen, ref.accountId, ref.chatId]);
};
