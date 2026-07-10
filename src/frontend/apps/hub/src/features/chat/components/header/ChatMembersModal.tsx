import { Button } from "@gouvfr-lasuite/cunningham-react";
import { ShareModal, type DropdownMenuOption } from "@gouvfr-lasuite/ui-kit";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useChatMembers } from "@/features/chat/hooks/useChatMembers";
import type { Chat, ChatMember } from "@/features/drivers/types";

type ChatMembersModalProps = {
  chat: Chat;
  isOpen: boolean;
  onClose: () => void;
};

const READ_ONLY_ROLE = "member";
const READ_ONLY_ROLES: DropdownMenuOption[] = [
  { label: "", value: READ_ONLY_ROLE },
];
const ignoreSearch = () => {};
const ignoreInvite = () => {};

const toShareUser = (member: ChatMember) => ({
  id: member.id,
  full_name: member.name,
  email: member.secondaryText,
});

/** UI-kit ShareModal adapter with every membership mutation switched off. */
export const ChatMembersModal = ({
  chat,
  isOpen,
  onClose,
}: ChatMembersModalProps) => {
  const { t } = useTranslation();
  const { present, pendingInvites, isInitialLoading, isError, refetch } =
    useChatMembers(chat.ref, isOpen);
  const accesses = useMemo(
    () =>
      present.map((member) => ({
        id: member.id,
        role: READ_ONLY_ROLE,
        user: toShareUser(member),
        is_explicit: false,
        can_delete: false,
      })),
    [present],
  );
  const invitations = useMemo(
    () =>
      pendingInvites.map((member) => ({
        id: member.id,
        role: READ_ONLY_ROLE,
        email: member.secondaryText,
        user: toShareUser(member),
      })),
    [pendingInvites],
  );

  return (
    <ShareModal<unknown, unknown, unknown>
      modalTitle={t("Chat members")}
      isOpen={isOpen}
      onClose={onClose}
      canUpdate={false}
      canView={!isError}
      cannotViewMessage={t(
        "The members could not be loaded. Please try again.",
      )}
      cannotViewChildren={
        <Button variant="secondary" size="small" onClick={refetch}>
          {t("Try again")}
        </Button>
      }
      loading={isInitialLoading}
      searchUsersResult={[]}
      onSearchUsers={ignoreSearch}
      onInviteUser={ignoreInvite}
      invitationRoles={READ_ONLY_ROLES}
      accesses={accesses}
      invitations={invitations}
    />
  );
};
