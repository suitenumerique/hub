import { useQuery } from "@tanstack/react-query";

import { getHubApi } from "@/features/config/HubApi";
import type { ChatRef } from "@/features/drivers/types";

import { groupKeys } from "../groupKeys";

/** The members of a group and their role, loaded while `enabled`. */
export const useGroupAccesses = (
  groupId: string,
  chatRef: ChatRef,
  enabled: boolean,
) =>
  useQuery({
    queryKey: groupKeys.accesses(groupId),
    queryFn: () => getHubApi().getGroupAccesses(groupId, chatRef),
    enabled,
    meta: { noGlobalError: true },
  });
