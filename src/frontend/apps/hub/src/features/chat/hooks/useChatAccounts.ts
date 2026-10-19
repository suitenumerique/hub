import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { chatAccountsFor } from "@/features/config/Config";
import { useConfig } from "@/features/config/ConfigProvider";
import {
  getRegistry,
  useDriverEntries,
} from "@/features/drivers/DriverRegistry";
import type { AccountId } from "@/features/drivers/types";

/**
 * Reconciles the runtime manifest of the Matrix environment set by the backend
 * configuration. The manifest remains an array and the registry remains
 * account-scoped so another Matrix server can be added later without changing
 * routes, hooks, or query keys.
 */
export const useChatAccountsBootstrap = (
  sessionOwner: string | null = null,
) => {
  const entries = useDriverEntries();
  const queryClient = useQueryClient();
  const { config } = useConfig();
  const environment = config.FRONTEND_CHAT_ENVIRONMENT;
  const accounts = useMemo(() => chatAccountsFor(environment), [environment]);

  useEffect(() => {
    // Message caches are account-scoped; remove the previous Hub user's views
    // before the new driver's connection can expose its conversations.
    queryClient.removeQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" &&
        (query.queryKey[0].startsWith("chat") ||
          query.queryKey[0].startsWith("conversation-search")),
    });
    if (accounts) {
      getRegistry().reconcile(accounts, sessionOwner);
    }
    return () => getRegistry().destroyAll();
  }, [accounts, queryClient, sessionOwner]);

  const enabledCount =
    accounts?.filter((account) => account.enabled).length ?? 0;
  return {
    /** The backend sets no known chat environment: the chat cannot start. */
    isUnconfigured: accounts === null,
    isReconciling:
      entries.length !== enabledCount ||
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
