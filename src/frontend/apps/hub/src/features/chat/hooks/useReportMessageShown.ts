import { useEffect } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";

/** A row in the list counts as displayed, whatever its message then becomes. */
export const useReportMessageShown = (
  ref: ChatRef,
  messageId: string,
): void => {
  useEffect(() => {
    getRegistry().get(ref.accountId).noteMessageShown(ref.chatId, messageId);
  }, [messageId, ref.accountId, ref.chatId]);
};
