import { useQueries } from "@tanstack/react-query";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type {
  AccountId,
  ChatNotificationPreferences,
  ChatNotificationPreferencesByChat,
  ChatRef,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export const DEFAULT_CHAT_NOTIFICATION_PREFERENCES: ChatNotificationPreferences =
  {
    room: { muted: false },
    threads: {},
  };

export const getChatNotificationPreferences = (
  preferencesByChat: ChatNotificationPreferencesByChat | undefined,
  chatId: string,
): ChatNotificationPreferences =>
  preferencesByChat?.[chatId] ?? DEFAULT_CHAT_NOTIFICATION_PREFERENCES;

export const isChatMuted = (
  preferences: ChatNotificationPreferences | undefined,
): boolean => preferences?.room.muted ?? false;

export const isChatThreadMuted = (
  preferences: ChatNotificationPreferences | undefined,
  threadId: string,
): boolean => preferences?.threads[threadId]?.muted ?? false;

export type ChatNotificationPreferencesLookup = (
  ref: ChatRef,
) => ChatNotificationPreferences;

/**
 * Seeds one small preference query per active account and exposes a lookup for
 * conversation and thread surfaces. Live events patch these same cache keys.
 */
export const useChatNotificationPreferences =
  (): ChatNotificationPreferencesLookup => {
    const entries = useDriverEntries();

    return useQueries({
      queries: entries.map(({ accountId, driver }) => ({
        queryKey: chatKeys.notificationPreferencesOf(accountId),
        queryFn: () => driver.getNotificationPreferences(),
        staleTime: Infinity,
        meta: { noGlobalError: true },
      })),
      combine: (results) => {
        const byAccount = new Map<
          AccountId,
          ChatNotificationPreferencesByChat
        >();
        entries.forEach((entry, index) => {
          const preferences = results[index]?.data;
          if (preferences) {
            byAccount.set(entry.accountId, preferences);
          }
        });
        return (ref: ChatRef): ChatNotificationPreferences =>
          getChatNotificationPreferences(
            byAccount.get(ref.accountId),
            ref.chatId,
          );
      },
    });
  };
