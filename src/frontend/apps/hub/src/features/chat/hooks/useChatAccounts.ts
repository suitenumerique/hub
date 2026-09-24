import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
export const useChatAccountsBootstrap = (
  sessionOwner: string | null = null,
) => {
  const entries = useDriverEntries();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Message caches are account-scoped; remove the previous Hub user's views
    // before the new driver's connection can expose its conversations.
    queryClient.removeQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" &&
        (query.queryKey[0].startsWith("chat") ||
          query.queryKey[0].startsWith("conversation-search")),
    });
    getRegistry().reconcile(MATRIX_LOCAL_ACCOUNTS, sessionOwner);
    return () => getRegistry().destroyAll();
  }, [queryClient, sessionOwner]);

  return {
    isReconciling:
      entries.length !== MATRIX_LOCAL_ACCOUNTS.length ||
      entries.some((entry) => entry.sessionOwner !== sessionOwner),
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
