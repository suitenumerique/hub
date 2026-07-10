import { useMemo } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { AccountId } from "@/features/drivers/types";

/**
 * Whether the given account's driver can start a brand-new conversation from a
 * participant set (see `Driver.supportsConversationCreation`). Drives whether the
 * New Chat composer is usable for a not-yet-existing conversation. Keyed by
 * account id (not a `ChatRef`) since a draft conversation has no id yet.
 */
export const useChatCreationSupport = (
  accountId: AccountId | null,
): boolean => {
  const entries = useDriverEntries();

  return useMemo(() => {
    if (!accountId) {
      return false;
    }
    return (
      entries.find((entry) => entry.accountId === accountId)?.driver
        .supportsConversationCreation ?? false
    );
  }, [entries, accountId]);
};
