import { useMemo } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";

/** Thread writing is an independent capability from top-level composition. */
export const useChatThreadCompositionSupport = (
  ref: ChatRef | null,
): boolean => {
  const entries = useDriverEntries();

  return useMemo(() => {
    if (!ref) {
      return false;
    }
    return (
      entries.find((entry) => entry.accountId === ref.accountId)?.driver
        .supportsThreadComposition ?? false
    );
  }, [entries, ref]);
};

/** Whether the account's threads are identified by their root message. */
export const useChatThreadsKeyedByRoot = (ref: ChatRef | null): boolean => {
  const entries = useDriverEntries();

  return useMemo(() => {
    if (!ref) {
      return false;
    }
    return (
      entries.find((entry) => entry.accountId === ref.accountId)?.driver
        .threadsKeyedByRoot ?? false
    );
  }, [entries, ref]);
};
