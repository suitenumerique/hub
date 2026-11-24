import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getHubApi } from "@/features/config/HubApi";

import { groupKeys } from "../groupKeys";
import type {
  AddGroupAccessesPayload,
  CreateGroupPayload,
  Group,
  GroupRole,
  UpdateGroupPayload,
} from "../types";

/** Creates a group; the list of groups is fetched again. */
export const useCreateGroup = () => {
  const queryClient = useQueryClient();
  return useMutation<Group | undefined, Error, CreateGroupPayload>({
    mutationFn: (payload) => getHubApi().createGroup(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: groupKeys.list() }),
    meta: { noGlobalError: true },
  });
};

/** Changes a group's name and emoji; the list of groups is fetched again. */
export const useUpdateGroup = (groupId: string) => {
  const queryClient = useQueryClient();
  return useMutation<Group | undefined, Error, UpdateGroupPayload>({
    mutationFn: (payload) => getHubApi().updateGroup(groupId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: groupKeys.list() }),
    meta: { noGlobalError: true },
  });
};

/**
 * Add, change the role of, and remove members. The list of members is fetched
 * again after each action, whether it worked or not.
 */
export const useGroupAccessMutations = (groupId: string) => {
  const queryClient = useQueryClient();
  const options = {
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: groupKeys.accesses(groupId) }),
    meta: { noGlobalError: true },
  };

  const add = useMutation<void, Error, AddGroupAccessesPayload>({
    mutationFn: (payload) => getHubApi().addGroupAccesses(groupId, payload),
    ...options,
  });

  const updateRole = useMutation<
    void,
    Error,
    { accessId: string; role: GroupRole }
  >({
    mutationFn: ({ accessId, role }) =>
      getHubApi().updateGroupAccess(groupId, accessId, role),
    ...options,
  });

  const remove = useMutation<void, Error, { accessId: string }>({
    mutationFn: ({ accessId }) =>
      getHubApi().deleteGroupAccess(groupId, accessId),
    ...options,
  });

  return { add, updateRole, remove };
};
