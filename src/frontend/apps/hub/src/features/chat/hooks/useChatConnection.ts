import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

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
 * query is keyed by the Hub user so logging in/out re-runs the handshake.
 */
export const useChatConnections = (
  user: User | null | undefined,
): ChatConnectionState => {
  const entries = useDriverEntries();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  useEffect(() => {
    const cleanups = entries.map((entry) =>
      entry.driver.subscribeToEvents((event) => {
        if (event.type !== "connection:invalidated") return;
        const queryKey = [
          ...chatKeys.connection(entry.accountId, userId),
          entry.generation,
        ];
        // Connection results otherwise stay fresh indefinitely. Hide the old
        // connected state while this driver revalidates its saved session.
        queryClient.setQueryData<ChatConnectionState>(queryKey, {
          status: "connecting",
          chatUser: null,
        });
        void queryClient.invalidateQueries({ queryKey, exact: true });
      }),
    );
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [entries, userId, queryClient]);

  return useQueries({
    queries: entries.map((entry) => ({
      queryKey: [
        ...chatKeys.connection(entry.accountId, userId),
        entry.generation,
      ],
      queryFn: () => entry.driver.connect(user),
      enabled:
        user !== undefined && user !== null && entry.sessionOwner === userId,
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
      const blocked = requiredResults.find(
        ({ result }) => result?.data?.status === "blocked",
      );
      if (blocked?.result.data) return blocked.result.data;
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
