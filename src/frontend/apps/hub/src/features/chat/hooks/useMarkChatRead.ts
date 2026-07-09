import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";

/** Sends the active account's read marker; the receipt event patches unread. */
export const useMarkChatRead = (ref: ChatRef): (() => Promise<void>) => {
  const { mutateAsync } = useMutation<void, Error, void>({
    mutationFn: () => getRegistry().get(ref.accountId).markChatRead(ref.chatId),
    meta: { noGlobalError: true },
  });

  return useCallback(() => mutateAsync(), [mutateAsync]);
};
