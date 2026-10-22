import { useEffect } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatMessage, ChatRef } from "@/features/drivers/types";

/**
 * A message shown still encrypted asks its driver to decrypt it and publish it
 * again once readable, as Element's EventTile does for each event it shows.
 * Its row then cannot stay on "awaiting decryption" after the event decrypted.
 */
export const useEnsureMessageDecrypted = (
  ref: ChatRef,
  messageId: string,
  availability: ChatMessage["availability"],
): void => {
  const isEncrypted =
    availability === "encrypted-pending" ||
    availability === "encrypted-unavailable" ||
    availability === "encrypted-error";
  useEffect(() => {
    if (isEncrypted) {
      getRegistry()
        .get(ref.accountId)
        .ensureMessageDecrypted(ref.chatId, messageId);
    }
  }, [isEncrypted, messageId, ref.accountId, ref.chatId]);
};
