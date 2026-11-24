import { useQuery } from "@tanstack/react-query";

import { getHubApi } from "@/features/config/HubApi";
import type { Chat } from "@/features/drivers/types";

import { groupKeys } from "../groupKeys";
import type { Group } from "../types";

const GROUPS_STALE_TIME = 60_000;

/**
 * The group of a conversation, or `null`. The conversations still come from
 * the chat driver: the Hub only tells which ones are groups, by room id. A
 * direct conversation is never a group and asks nothing.
 */
export const useGroupForChat = (chat: Chat): Group | null => {
  const canBeGroup = chat.kind === "group";
  const { data: groups } = useQuery({
    queryKey: groupKeys.list(),
    queryFn: () => getHubApi().getGroups(),
    enabled: canBeGroup,
    staleTime: GROUPS_STALE_TIME,
    meta: { noGlobalError: true },
  });
  if (!canBeGroup) {
    return null;
  }
  return groups?.find((group) => group.matrix?.room_id === chat.id) ?? null;
};
