import { useQueries, type UseQueryResult } from "@tanstack/react-query";

import { decorateChatSections } from "@/features/chat/chatRefs";
import { compareChats } from "@/features/chat/chatSorting";
import {
  useDriverEntries,
  type DriverEntry,
} from "@/features/drivers/DriverRegistry";
import type {
  AccountId,
  ChatSections,
  LocalChatSections,
  MergedChatsResult,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

const EMPTY_SECTIONS: ChatSections = {
  favourites: [],
  all: [],
};

const mergeSorted = (sections: ChatSections[]): ChatSections => ({
  favourites: sections
    .flatMap((section) => section.favourites)
    .sort(compareChats),
  all: sections.flatMap((section) => section.all).sort(compareChats),
});

export const mergeChatSections = (
  entries: DriverEntry[],
  results: UseQueryResult<ChatSections, Error>[],
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
  const merged = mergeSorted(visibleSections);

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
      ),
  });
};
