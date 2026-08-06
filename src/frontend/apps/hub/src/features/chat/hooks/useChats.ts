import { useQueries, type UseQueryResult } from "@tanstack/react-query";

import { decorateChatSections } from "@/features/chat/chatRefs";
import {
  compareChats,
  compareChatsWithActivity,
} from "@/features/chat/chatSorting";
import {
  useDriverEntries,
  type DriverEntry,
} from "@/features/drivers/DriverRegistry";
import type {
  AccountId,
  ChatNotificationPreferences,
  ChatRef,
  ChatSections,
  LocalChatSections,
  MergedChatsResult,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";
import { useChatNotificationPreferences } from "./useChatNotificationPreferences";

const EMPTY_SECTIONS: ChatSections = {
  favourites: [],
  all: [],
};

type NotificationPreferencesLookup = (
  ref: ChatRef,
) => ChatNotificationPreferences;

const mergeSorted = (
  sections: ChatSections[],
  getPreferences?: NotificationPreferencesLookup,
): ChatSections => ({
  favourites: sections
    .flatMap((section) => section.favourites)
    .sort(
      getPreferences
        ? compareChatsWithActivity(
            // The driver keeps this cursor frozen through mute and unmute until
            // the first later activity, preventing backlog ranking replay.
            (chat) =>
              getPreferences(chat.ref).room.rankingActivityAt ??
              chat.lastActivityAt,
          )
        : compareChats,
    ),
  all: sections
    .flatMap((section) => section.all)
    .sort(
      getPreferences
        ? compareChatsWithActivity(
            // Keep muted rooms in the normal section; only their cursor differs.
            (chat) =>
              getPreferences(chat.ref).room.rankingActivityAt ??
              chat.lastActivityAt,
          )
        : compareChats,
    ),
});

export const mergeChatSections = (
  entries: DriverEntry[],
  results: UseQueryResult<ChatSections, Error>[],
  getPreferences?: NotificationPreferencesLookup,
): MergedChatsResult => {
  const byAccount = new Map<AccountId, ChatSections>();
  const accountErrors = new Map<AccountId, unknown>();

  entries.forEach((entry, index) => {
    const result = results[index];
    if (result?.data) {
      byAccount.set(entry.accountId, result.data);
    }
    if (result?.error) {
      accountErrors.set(entry.accountId, result.error);
    }
  });

  const visibleSections = entries.map(
    (entry) => byAccount.get(entry.accountId) ?? EMPTY_SECTIONS,
  );
  const merged = mergeSorted(visibleSections, getPreferences);

  return {
    ...merged,
    byAccount,
    accountErrors,
    isLoadingRequiredAccounts: entries.some((entry, index) => {
      const result = results[index];
      return entry.criticality === "required" && result?.isPending;
    }),
    isLoading: results.some((result) => result.isPending),
    isError: results.some((result) => result.isError),
  };
};

export const useChats = (): MergedChatsResult => {
  const entries = useDriverEntries();
  const getPreferences = useChatNotificationPreferences();

  return useQueries({
    queries: entries.map((entry) => ({
      queryKey: chatKeys.chatsOf(entry.accountId),
      queryFn: async () => {
        const localSections: LocalChatSections = await entry.driver.getChats();
        return decorateChatSections(entry.accountId, localSections);
      },
      staleTime: Infinity,
      meta: { noGlobalError: true },
    })),
    combine: (results) =>
      mergeChatSections(
        entries,
        results as UseQueryResult<ChatSections, Error>[],
        getPreferences,
      ),
  });
};
