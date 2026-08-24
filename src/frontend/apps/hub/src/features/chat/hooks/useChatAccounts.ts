import { useEffect } from "react";

import { MATRIX_LOCAL_ACCOUNTS } from "@/features/config/Config";
import {
  getRegistry,
  useDriverEntries,
} from "@/features/drivers/DriverRegistry";
import type { AccountId } from "@/features/drivers/types";

/**
 * Reconciles the single runtime manifest. The manifest remains an array and the
 * registry remains account-scoped so another fixed Matrix server can be added
 * later without changing routes, hooks, or query keys.
 */
export const useChatAccountsBootstrap = () => {
  const entries = useDriverEntries();

  useEffect(() => {
    getRegistry().reconcile(MATRIX_LOCAL_ACCOUNTS);
    return () => getRegistry().destroyAll();
  }, []);

  return {
    isReconciling: entries.length !== MATRIX_LOCAL_ACCOUNTS.length,
  };
};

/** The required account used by the new-conversation composer. */
export const useComposerAccountId = (): AccountId | null => {
  const entries = useDriverEntries();
  const account =
    entries.find((candidate) => candidate.criticality === "required") ??
    entries[0];
  return account?.accountId ?? null;
};
