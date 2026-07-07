import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";

/**
 * Marks a conversation read through the driver. The unread dot is NOT cleared
 * optimistically here: the driver recomputes the conversation's full read state
 * (main timeline AND threads) and announces it via `unread:changed`, which the
 * bridge patches into the read-state slice. That event is near-instant — the
 * Matrix SDK adds the read receipt's local echo synchronously, and the mock
 * emits synchronously — so the dot updates immediately AND correctly: a
 * conversation whose only unread is in a thread (which a main-timeline receipt
 * does not clear) keeps its dot. Returns a stable callback for effect deps.
 */
export const useMarkChatRead = (ref: ChatRef | null): (() => void) => {
  const { mutate } = useMutation<unknown, Error, void>({
    mutationFn: () => {
      if (!ref) {
        return Promise.resolve();
      }
      return getRegistry().get(ref.accountId).markChatRead(ref.chatId);
    },
    meta: { noGlobalError: true },
  });

  return useCallback(() => {
    mutate();
  }, [mutate]);
};
