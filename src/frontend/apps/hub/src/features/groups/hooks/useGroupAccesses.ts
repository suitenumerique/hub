import { useQuery } from "@tanstack/react-query";

import { getHubApi } from "@/features/config/HubApi";

import { groupKeys } from "../groupKeys";

/** The members of a group and their role, loaded while `enabled`. */
export const useGroupAccesses = (groupId: string, enabled: boolean) =>
  useQuery({
    queryKey: groupKeys.accesses(groupId),
    queryFn: () => getHubApi().getGroupAccesses(groupId),
    enabled,
    meta: { noGlobalError: true },
  });
