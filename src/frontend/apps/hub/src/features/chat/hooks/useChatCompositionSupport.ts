import { useMemo } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";

export const useChatCompositionSupport = (ref: ChatRef | null): boolean => {
  const entries = useDriverEntries();

  return useMemo(() => {
    if (!ref) {
      return false;
    }
    return (
      entries.find((entry) => entry.accountId === ref.accountId)?.driver
        .supportsComposition ?? false
    );
  }, [entries, ref]);
};
