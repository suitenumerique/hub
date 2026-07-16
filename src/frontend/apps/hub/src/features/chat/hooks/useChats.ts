import {
  useQueries,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { decorateChatSections } from "@/features/chat/chatRefs";
import { compareChats } from "@/features/chat/chatSorting";
import {
  applyHubGroupsToSections,
  getHubGroupCandidateRoomIdsFromSections,
  hubGroupResolutionQueryOptions,
  type HubGroupResolutionSnapshot,
} from "@/features/chat/hubGroups";
import {
  useDriverEntries,
  type DriverEntry,
} from "@/features/drivers/DriverRegistry";
import type {
  AccountId,
  ChatSections,
  HubGroup,
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
  groupResults: UseQueryResult<HubGroup[], Error>[],
  candidateIds: string[][],
  lastSuccessfulResolutions: (HubGroupResolutionSnapshot | undefined)[],
): MergedChatsResult => {
  const byAccount = new Map<AccountId, ChatSections>();
  const accountErrors = new Map<AccountId, unknown>();

  entries.forEach((entry, index) => {
    const result = results[index];
    if (result?.data) {
      byAccount.set(
        entry.accountId,
        applyHubGroupsToSections(
          result.data,
          groupResults[index]?.data ??
            lastSuccessfulResolutions[index]?.groups ??
            [],
        ),
      );
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
    isResolvingHubGroups: entries.some(
      (entry, index) =>
        entry.driver.supportsHubGroupCreation &&
        candidateIds[index].length > 0 &&
        groupResults[index]?.isPending,
    ),
  };
};

export const useChats = (): MergedChatsResult => {
  const entries = useDriverEntries();
  const queryClient = useQueryClient();
  const lastStoredGroups = useRef(
    new Map<AccountId, { candidateKey: string; groups: HubGroup[] }>(),
  );

  const results = useQueries({
    queries: entries.map((entry) => ({
      queryKey: chatKeys.chatsOf(entry.accountId),
      queryFn: async () =>
        decorateChatSections(entry.accountId, await entry.driver.getChats()),
      staleTime: Infinity,
      meta: { noGlobalError: true },
    })),
  }) as UseQueryResult<ChatSections, Error>[];

  const candidateIds = entries.map((_entry, index) => {
    const sections = results[index]?.data;
    return sections ? getHubGroupCandidateRoomIdsFromSections(sections) : [];
  });
  const groupResults = useQueries({
    queries: entries.map((entry, index) => ({
      ...hubGroupResolutionQueryOptions(
        entry.driver,
        entry.accountId,
        candidateIds[index],
      ),
      enabled:
        Boolean(results[index]?.data) &&
        entry.driver.supportsHubGroupCreation &&
        candidateIds[index].length > 0,
    })),
  }) as UseQueryResult<HubGroup[], Error>[];
  const lastSuccessfulGroupResults = useQueries({
    queries: entries.map((entry) => ({
      queryKey: chatKeys.lastResolvedHubGroupsOf(entry.accountId),
      queryFn: async (): Promise<HubGroupResolutionSnapshot> => ({
        candidateRoomIds: [],
        groups: [],
      }),
      enabled: false,
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  }) as UseQueryResult<HubGroupResolutionSnapshot, Error>[];

  useEffect(() => {
    entries.forEach((entry, index) => {
      const groups = groupResults[index]?.data;
      const cacheKey = chatKeys.lastResolvedHubGroupsOf(entry.accountId);
      const candidateKey = candidateIds[index].join("\0");
      const stored = lastStoredGroups.current.get(entry.accountId);
      if (
        groups &&
        (stored?.groups !== groups || stored.candidateKey !== candidateKey)
      ) {
        lastStoredGroups.current.set(entry.accountId, { candidateKey, groups });
        queryClient.setQueryData<HubGroupResolutionSnapshot>(cacheKey, {
          candidateRoomIds: candidateIds[index],
          groups,
        });
      }
    });
  }, [candidateIds, entries, groupResults, queryClient]);

  const lastSuccessfulResolutions = entries.map(
    (_entry, index) => lastSuccessfulGroupResults[index]?.data,
  );

  return mergeChatSections(
    entries,
    results,
    groupResults,
    candidateIds,
    lastSuccessfulResolutions,
  );
};
