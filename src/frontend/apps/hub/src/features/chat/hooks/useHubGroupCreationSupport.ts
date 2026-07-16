import { useMemo } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { AccountId } from "@/features/drivers/types";

export const useHubGroupCreationSupport = (
  accountId: AccountId | null,
): boolean => {
  const entries = useDriverEntries();
  return useMemo(
    () =>
      Boolean(
        accountId &&
        entries.find((entry) => entry.accountId === accountId)?.driver
          .supportsHubGroupCreation,
      ),
    [accountId, entries],
  );
};
