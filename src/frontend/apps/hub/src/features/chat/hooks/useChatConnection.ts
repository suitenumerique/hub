import { useQueries } from "@tanstack/react-query";

import { chatKeys } from "@/features/chat/chatKeys";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { ChatConnectionState } from "@/features/drivers/Driver";
import type { User } from "@/features/drivers/types";

const DISCONNECTED: ChatConnectionState = {
  status: "idle",
  chatUser: null,
};

/**
 * Backend-agnostic chat connection. Delegates the handshake to the active
 * driver and lets React Query own the resulting state — no bespoke store. The
 * query is keyed by the Hub user so logging in/out re-runs the handshake; mock
 * (and any no-handshake) drivers resolve immediately as `connected`.
 */
export const useChatConnections = (
  user: User | null | undefined,
): ChatConnectionState => {
  const entries = useDriverEntries();
  const userId = user?.id ?? null;

  return useQueries({
    queries: entries.map((entry) => ({
      queryKey: chatKeys.connection(entry.accountId, userId),
      queryFn: () => entry.driver.connect(user),
      enabled: user !== undefined && user !== null,
      staleTime: Infinity,
      meta: { noGlobalError: true },
    })),
    combine: (results): ChatConnectionState => {
      if (!user) {
        return DISCONNECTED;
      }

      const requiredResults = entries
        .map((entry, index) => ({ entry, result: results[index] }))
        .filter(({ entry }) => entry.criticality === "required");

      const requiredError = requiredResults.find(
        ({ result }) => result?.isError || result?.data?.status === "error",
      );
      if (requiredError) {
        return {
          status: "error",
          chatUser: null,
          error: requiredError.result.error ?? requiredError.result.data?.error,
        };
      }

      const redirect = results
        .map((result) => result.data?.redirectTo)
        .find((url): url is string => Boolean(url));
      if (redirect) {
        return {
          status: "connecting",
          chatUser: null,
          redirectTo: redirect,
        };
      }

      const requiredConnecting = requiredResults.some(
        ({ result }) =>
          result?.isPending || result?.data?.status === "connecting",
      );
      if (requiredConnecting) {
        return { status: "connecting", chatUser: null };
      }

      return {
        status: "connected",
        chatUser:
          results.find((result) => result.data?.chatUser)?.data?.chatUser ??
          null,
      };
    },
  });
};
