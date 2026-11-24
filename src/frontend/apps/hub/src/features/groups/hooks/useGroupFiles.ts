import { useQuery } from "@tanstack/react-query";

import { getHubApi } from "@/features/config/HubApi";

import { groupKeys } from "../groupKeys";

/** The Drive files shared with a group, loaded while `enabled`. */
export const useGroupFiles = (groupId: string, enabled: boolean) =>
  useQuery({
    queryKey: groupKeys.files(groupId),
    queryFn: () => getHubApi().getGroupFiles(groupId),
    enabled,
    meta: { noGlobalError: true },
  });
