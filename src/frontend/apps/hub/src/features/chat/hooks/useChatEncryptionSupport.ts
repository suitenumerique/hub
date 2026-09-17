import { useMemo } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { AccountId } from "@/features/drivers/types";

/**
 * Whether the given account's driver can create end-to-end encrypted
 * conversations (see `Driver.supportsEncryption`). Drives whether the New Chat
 * screen offers the choice at all - a toggle that silently does nothing is
 * worse than no toggle.
 *
 * Keyed by account id rather than by `ChatRef`: the decision is made before the
 * room exists, and cannot be changed afterwards.
 */
export const useChatEncryptionSupport = (
  accountId: AccountId | null,
): boolean => {
  const entries = useDriverEntries();

  return useMemo(() => {
    if (!accountId) {
      return false;
    }
    return (
      entries.find((entry) => entry.accountId === accountId)?.driver
        .supportsEncryption ?? false
    );
  }, [entries, accountId]);
};
