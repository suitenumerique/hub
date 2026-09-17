import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { chatKeys } from "@/features/chat/chatKeys";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { Driver } from "@/features/drivers/Driver";
import type {
  AccountId,
  ChatSelfPresencePreference,
  ChatUserPresenceState,
} from "@/features/drivers/types";

export const CHAT_PRESENCE_IDLE_MS = 5 * 60 * 1000;

type ActivitySession = {
  accountId: AccountId;
  userId: string;
  driver: Driver;
  preference: ChatSelfPresencePreference;
  effectiveState: ChatUserPresenceState | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
};

/**
 * One app-wide activity controller. It owns one timer per connected account,
 * never per observed user, and publishes only effective state transitions.
 */
export const useChatPresenceActivity = (): void => {
  const queryClient = useQueryClient();
  const driverEntries = useDriverEntries();
  const connectionSignature = driverEntries
    .map(
      ({ accountId, driver }) =>
        `${accountId}:${driver.getCurrentUserId() ?? ""}`,
    )
    .join("\u0000");
  const entries = useMemo(
    () =>
      driverEntries.filter(
        ({ driver }) =>
          driver.supportsPresence && driver.getCurrentUserId() !== null,
      ),
    [connectionSignature, driverEntries],
  );
  const preferences = useQueries({
    queries: entries.map(({ accountId, driver }) => ({
      queryKey: chatKeys.selfPresencePreference(accountId),
      queryFn: () => driver.getSelfPresencePreference(),
      staleTime: Infinity,
    })),
    combine: (results) => results.map(({ data }) => data ?? null),
  });

  useEffect(() => {
    const sessions = entries.flatMap((entry, index): ActivitySession[] => {
      const preference = preferences[index];
      return preference
        ? [
            {
              accountId: entry.accountId,
              userId: entry.driver.getCurrentUserId()!,
              driver: entry.driver,
              preference,
              effectiveState: null,
              idleTimer: null,
            },
          ]
        : [];
    });

    const publish = (
      session: ActivitySession,
      state: ChatUserPresenceState,
    ) => {
      if (session.effectiveState === state) return;
      session.effectiveState = state;
      void session.driver
        .setUserPresence(state)
        .then(() => {
          queryClient.setQueryData(
            chatKeys.userPresence(session.accountId, session.userId),
            { userId: session.userId, state },
          );
        })
        .catch((error) => {
          session.effectiveState = null;
          console.error(
            `Presence activity update failed for ${session.accountId}`,
            error,
          );
        });
    };
    const clearIdleTimer = (session: ActivitySession) => {
      if (session.idleTimer === null) return;
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    };
    const activate = (session: ActivitySession) => {
      if (session.preference === "offline") return;
      publish(session, "online");
      clearIdleTimer(session);
      session.idleTimer = setTimeout(() => {
        session.idleTimer = null;
        publish(session, "unavailable");
      }, CHAT_PRESENCE_IDLE_MS);
    };
    const onActivity = () => sessions.forEach(activate);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onActivity();
    };

    sessions.forEach((session) => {
      if (session.preference === "offline") publish(session, "offline");
      else activate(session);
    });
    document.addEventListener("pointerdown", onActivity);
    document.addEventListener("keydown", onActivity);
    window.addEventListener("focus", onActivity);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("pointerdown", onActivity);
      document.removeEventListener("keydown", onActivity);
      window.removeEventListener("focus", onActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sessions.forEach(clearIdleTimer);
    };
  }, [entries, preferences, queryClient]);
};
