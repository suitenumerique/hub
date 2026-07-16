import { queryOptions } from "@tanstack/react-query";

import { chatKeys } from "@/features/chat/chatKeys";
import type {
  AccountId,
  HubGroup,
  LocalChat,
  LocalChatSections,
} from "@/features/drivers/types";
import { getHubApi } from "@/features/config/HubApi";
import type { Driver } from "@/features/drivers/Driver";

export type HubGroupResolutionSnapshot = {
  candidateRoomIds: string[];
  groups: HubGroup[];
};

/** Sorted candidate ids keep the POST small and the React Query key stable. */
export const getHubGroupCandidateRoomIds = (chats: LocalChat[]): string[] =>
  [
    ...new Set(
      chats.filter((chat) => chat.hubGroupCandidate).map((chat) => chat.id),
    ),
  ].sort();

export const getHubGroupCandidateRoomIdsFromSections = (
  sections: LocalChatSections,
): string[] =>
  getHubGroupCandidateRoomIds([...sections.favourites, ...sections.all]);

/** Confirm an untrusted Matrix shortlist with the authoritative Hub registry. */
export const resolveHubGroups = async (
  driver: Driver,
  accountId: AccountId,
  roomIds: string[],
): Promise<HubGroup[]> => {
  if (!driver.supportsHubGroupCreation || roomIds.length === 0) {
    return [];
  }
  const proof = await driver.getMatrixIdentityProof();
  return getHubApi().resolveHubGroups({
    matrix_account_id: accountId,
    matrix_access_token: proof.accessToken,
    room_ids: roomIds,
  });
};

export const hubGroupResolutionQueryOptions = (
  driver: Driver | null,
  accountId: AccountId,
  candidateRoomIds: string[],
) =>
  queryOptions({
    queryKey: chatKeys.hubGroups(accountId, candidateRoomIds),
    queryFn: () =>
      driver ? resolveHubGroups(driver, accountId, candidateRoomIds) : [],
    staleTime: 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2_000),
    refetchInterval: (query) =>
      query.state.status === "error" ? 30_000 : false,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
    meta: { noGlobalError: true },
  });

type HubGroupRoomIndexEntry = {
  group: HubGroup;
  role: HubGroup["rooms"][number]["role"];
  botIds: Set<string>;
};

const buildHubGroupRoomIndex = (
  groups: HubGroup[],
): Map<string, HubGroupRoomIndexEntry> => {
  const index = new Map<string, HubGroupRoomIndexEntry>();
  groups.forEach((group) => {
    const botIds = new Set(
      group.memberships
        .filter((membership) => membership.role === "bot")
        .map((membership) => membership.mxid),
    );
    group.rooms.forEach((room) => {
      index.set(room.room_id, { group, role: room.role, botIds });
    });
  });
  return index;
};

const applyHubGroupToChat = <T extends LocalChat>(
  chat: T,
  index: Map<string, HubGroupRoomIndexEntry>,
): T => {
  const resolution = index.get(chat.id);
  if (!resolution) {
    return chat;
  }
  const { group, botIds } = resolution;
  const activeRoom = group.rooms.find((room) => room.role === "active");
  return {
    ...chat,
    // Matrix is authoritative for effective room state. Prefer its current
    // name so an eventually-consistent registry projection cannot overwrite it.
    name:
      chat.name && chat.name !== chat.id
        ? chat.name
        : activeRoom?.name || chat.name,
    kind: "hub_group",
    participantIds: chat.participantIds.filter((id) => !botIds.has(id)),
    visual: { kind: "emoji", emoji: group.emoji || "🌲" },
    hubGroup: group,
  } as T;
};

/**
 * The Django registry is the only authority for Hub-group classification.
 * Matrix metadata is deliberately not used here: a forged custom state event
 * must never turn an arbitrary room into an official group in the UI.
 */
export const applyHubGroupsToChat = <T extends LocalChat>(
  chat: T,
  groups: HubGroup[],
): T => applyHubGroupToChat(chat, buildHubGroupRoomIndex(groups));

export const applyHubGroupsToSections = <T extends LocalChat>(
  sections: { favourites: T[]; all: T[] },
  groups: HubGroup[],
): { favourites: T[]; all: T[] } => {
  const index = buildHubGroupRoomIndex(groups);
  const mapVisible = (chats: T[]) =>
    chats
      .filter((chat) => {
        const resolution = index.get(chat.id);
        return !resolution || resolution.role === "active";
      })
      .map((chat) => applyHubGroupToChat(chat, index));

  return {
    favourites: mapVisible(sections.favourites),
    all: mapVisible(sections.all),
  };
};
