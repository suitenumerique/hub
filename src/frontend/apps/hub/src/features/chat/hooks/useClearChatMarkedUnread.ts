import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";

/**
 * Clears the "marked unread" flag once the open conversation was read. Silent:
 * the next read of the timeline tries again, and the /sync echo moves the dot.
 */
export const useClearChatMarkedUnread = (ref: ChatRef): (() => void) => {
  // A ref, not `isPending`: two reads measured in the same tick would both
  // see the state of the last render and clear the flag twice.
  const isClearingRef = useRef(false);
  const { mutate } = useMutation<void, Error, void>({
    mutationFn: () =>
      getRegistry().get(ref.accountId).setChatMarkedUnread(ref.chatId, false),
    onSettled: () => {
      isClearingRef.current = false;
    },
    meta: { noGlobalError: true },
  });

  return useCallback(() => {
    if (isClearingRef.current) {
      return;
    }
    isClearingRef.current = true;
    mutate();
  }, [mutate]);
};
