import { useEffect } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";

import { usePageVisible } from "./usePageVisible";

/**
 * While the open conversation shows, its thread replies no longer show it
 * unread in the list. The threads keep them unread. A reply received with the
 * page in the background brings the dot back until the page shows again.
 * Silent: a failed write only means the dot comes back, until the next visit.
 */
export const useChatVisit = (ref: ChatRef, isOpen: boolean): void => {
  const isPageVisible = usePageVisible();
  const isShown = isOpen && isPageVisible;

  useEffect(() => {
    if (!isShown) {
      return;
    }
    const driver = getRegistry().get(ref.accountId);
    void driver.startChatVisit(ref.chatId).catch(() => {});
    return () => {
      void driver.endChatVisit(ref.chatId).catch(() => {});
    };
  }, [isShown, ref.accountId, ref.chatId]);
};
