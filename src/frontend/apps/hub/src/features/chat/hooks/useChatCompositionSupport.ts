import { useMemo } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { AccountId, ChatRef } from "@/features/drivers/types";

export const useAccountChatCompositionSupport = (
  accountId: AccountId | null,
): boolean => {
  const entries = useDriverEntries();

  return useMemo(() => {
    if (!accountId) {
      return false;
    }
    return (
      entries.find((entry) => entry.accountId === accountId)?.driver
        .supportsComposition ?? false
    );
  }, [accountId, entries]);
};

export const useChatCompositionSupport = (ref: ChatRef | null): boolean =>
  useAccountChatCompositionSupport(ref?.accountId ?? null);
