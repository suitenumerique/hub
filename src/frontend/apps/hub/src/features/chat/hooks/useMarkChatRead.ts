import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { MarkChatReadResult } from "@/features/drivers/Driver";
import type { ChatRef } from "@/features/drivers/types";

/** Advances the active account's main read marker through one visible message. */
export const useMarkChatRead = (
  ref: ChatRef,
): ((messageId?: string) => Promise<MarkChatReadResult>) => {
  const { mutateAsync } = useMutation<
    MarkChatReadResult,
    Error,
    string | undefined
  >({
    mutationFn: (messageId) =>
      getRegistry()
        .get(ref.accountId)
        .markChatRead({ chatId: ref.chatId, messageId }),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    meta: { noGlobalError: true },
  });

  return useCallback((messageId) => mutateAsync(messageId), [mutateAsync]);
};
