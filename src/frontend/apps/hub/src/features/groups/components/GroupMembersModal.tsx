import {
  Button,
  type DropdownMenuOption,
  ShareModal,
} from "@gouvfr-lasuite/ui-components";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useChatUserSearch } from "@/features/chat/hooks/useChatUserSearch";
import type { ChatRef } from "@/features/drivers/types";

import { useGroupAccesses } from "../hooks/useGroupAccesses";
import { useGroupAccessMutations } from "../hooks/useGroupMutations";
import {
  type Group,
  GROUP_ROLES,
  type GroupAccess,
  type GroupRole,
  type GroupUser,
} from "../types";

type GroupMembersModalProps = {
  group: Group;
  /** The group's conversation. */
  chatRef: ChatRef;
  isOpen: boolean;
  onClose: () => void;
};

const isGroupRole = (role: string): role is GroupRole =>
  (GROUP_ROLES as readonly string[]).includes(role);

/**
 * The group's members and their role (#34), in the UI kit share modal. An
 * administrator adds people (with the New chat search), changes roles and
 * removes members; every action is one request to the Hub backend.
 */
export const GroupMembersModal = ({
  group,
  chatRef,
  isOpen,
  onClose,
}: GroupMembersModalProps) => {
  const { t } = useTranslation();
  const canManage = group.user_role === "administrator";
  const accesses = useGroupAccesses(group.id, chatRef, isOpen);
  const { add, updateRole, remove } = useGroupAccessMutations(group.id);
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const memberIds = useMemo(
    () => (accesses.data ?? []).map((access) => access.user.id),
    [accesses.data],
  );
  const search = useChatUserSearch(query, memberIds);
  const searchResults = useMemo<GroupUser[]>(
    () =>
      search.users.map(({ id, name, subtitle }) => ({
        id,
        full_name: name,
        email: subtitle,
      })),
    [search.users],
  );

  const roles = useMemo<DropdownMenuOption[]>(
    () =>
      GROUP_ROLES.map((role) => ({
        value: role,
        label: role === "administrator" ? t("Admin") : t("Member"),
      })),
    [t],
  );

  const isSaving = add.isPending || updateRole.isPending || remove.isPending;
  const fail = (message: string) => () => setErrorMessage(message);

  const invite = (users: GroupUser[], role: string) => {
    if (users.length === 0 || !isGroupRole(role)) {
      return;
    }
    setErrorMessage(null);
    add.mutate(
      { user_ids: users.map((user) => user.id), role },
      { onError: fail(t("The people could not be added. Please try again.")) },
    );
  };

  const changeRole = (access: GroupAccess, role: string) => {
    if (!isGroupRole(role) || role === access.role) {
      return;
    }
    setErrorMessage(null);
    updateRole.mutate(
      { accessId: access.id, role },
      { onError: fail(t("The role could not be changed. Please try again.")) },
    );
  };

  const removeMember = (access: GroupAccess) => {
    setErrorMessage(null);
    remove.mutate(
      { accessId: access.id },
      {
        onError: fail(t("The member could not be removed. Please try again.")),
      },
    );
  };

  const close = () => {
    setQuery("");
    setErrorMessage(null);
    onClose();
  };

  return (
    <ShareModal<GroupUser, unknown, GroupAccess>
      modalTitle={t("Group members")}
      isOpen={isOpen}
      onClose={close}
      canUpdate={canManage && !accesses.isError}
      canView={!accesses.isError}
      cannotViewMessage={t(
        "The members could not be loaded. Please try again.",
      )}
      cannotViewChildren={
        <Button
          variant="secondary"
          size="small"
          onClick={() => void accesses.refetch()}
        >
          {t("Try again")}
        </Button>
      }
      loading={accesses.isPending}
      hideInvitations
      allowInvitation={false}
      invitationRoles={roles}
      getAccessRoles={() => roles}
      accesses={accesses.data ?? []}
      searchUsersResult={searchResults}
      searchPlaceholder={t("Search people")}
      onSearchUsers={setQuery}
      onInviteUser={invite}
      onUpdateAccess={changeRole}
      onDeleteAccess={removeMember}
    >
      <div className="hub__group-members__status">
        <p role="status">{isSaving ? t("Saving…") : ""}</p>
        {errorMessage && <p role="alert">{errorMessage}</p>}
      </div>
    </ShareModal>
  );
};
