import {
  queryOptions,
  useQueries,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { decorateChatSections } from "@/features/chat/chatRefs";
import { compareChats } from "@/features/chat/chatSorting";
import { queryReadOptions } from "@/features/drivers/Driver";
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

const chatsQuery = (entry: DriverEntry) =>
  queryOptions({
    queryKey: chatKeys.chatsOf(entry.accountId),
    queryFn: async (context) => {
      const localSections: LocalChatSections = await entry.driver.getChats(
        queryReadOptions(context),
      );
      return decorateChatSections(entry.accountId, localSections);
    },
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

const sameEntries = <K, V>(a: Map<K, V>, b: Map<K, V>): boolean =>
  a.size === b.size && [...a].every(([key, value]) => b.get(key) === value);

/**
 * The previous result while nothing it shows changed. A refetch returning the
 * same conversations keeps each account's data object (structural sharing),
 * and a fetch status flip changes nothing shown: returning the same object
 * then spares the conversation list a render.
 */
const keepUnchanged = (
  previous: MergedChatsResult | null,
  next: MergedChatsResult,
): MergedChatsResult =>
  previous &&
  previous.isLoading === next.isLoading &&
  previous.isError === next.isError &&
  previous.isLoadingRequiredAccounts === next.isLoadingRequiredAccounts &&
  sameEntries(previous.byAccount, next.byAccount) &&
  sameEntries(previous.accountErrors, next.accountErrors)
    ? previous
    : next;

export const useChats = (): MergedChatsResult => {
  const entries = useDriverEntries();
  const combine = useCallback(
    (results: UseQueryResult<ChatSections, Error>[]) =>
      mergeChatSections(entries, results),
    [entries],
  );
  const next = useQueries({ queries: entries.map(chatsQuery), combine });
  // The result shown last lives in state, the way React keeps information
  // from previous renders: replacing it during render re-renders at once.
  const [shown, setShown] = useState(next);
  const result = keepUnchanged(shown, next);
  if (result !== shown) {
    setShown(result);
  }
  return result;
};

const hasNoChats = (results: UseQueryResult<ChatSections, Error>[]) =>
  results.every(
    (result) =>
      !result.isPending && !result.isError && result.data.all.length === 0,
  );

/**
 * Whether every account loaded and none has a conversation. A boolean, so a
 * view that only needs this does not re-render with every list change.
 */
export const useHasNoChats = (): boolean => {
  const entries = useDriverEntries();
  return useQueries({ queries: entries.map(chatsQuery), combine: hasNoChats });
};
