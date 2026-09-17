import { Button } from "@gouvfr-lasuite/ui-components";
import {
  ShareModal,
  type DropdownMenuOption,
} from "@gouvfr-lasuite/ui-components";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { useChatMembers } from "@/features/chat/hooks/useChatMembers";
import { useChatUserPresence } from "@/features/chat/hooks/useChatUserPresence";
import { useMyAvatarSrc } from "@/features/chat/hooks/useMyAvatarSrc";
import type { Chat, ChatMember } from "@/features/drivers/types";
import { useAvatarPortalOverlay } from "@/features/ui/components/avatar/useAvatarPortalOverlay";
import { UserPresenceIndicator } from "@/features/ui/components/presence/UserPresenceIndicator";

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

const MemberPresence = ({
  accountId,
  member,
  target,
}: {
  accountId: Chat["accountId"];
  member: ChatMember;
  target: HTMLElement;
}) => {
  const presence = useChatUserPresence(accountId, member.id);
  return createPortal(
    <UserPresenceIndicator state={presence?.state ?? null} />,
    target,
  );
};

/** Adds React-owned presence content to the UI kit's portaled member rows. */
const MemberPresencePortals = ({
  accountId,
  members,
}: {
  accountId: Chat["accountId"];
  members: ChatMember[];
}) => {
  const markerRef = useRef<HTMLSpanElement>(null);
  const [targets, setTargets] = useState<HTMLElement[]>([]);

  useLayoutEffect(() => {
    const modal = markerRef.current?.closest(".c__share-modal");
    const names = modal
      ? Array.from(
          modal.querySelectorAll(
            ".c__share-modal__members .c__share-member-item .c__user-row__name",
          ),
        ).slice(0, members.length)
      : [];
    const nextTargets = names.map((name) => {
      const target = document.createElement("span");
      target.className = "hub__member-presence-target";
      name.appendChild(target);
      return target;
    });
    setTargets(nextTargets);

    return () => nextTargets.forEach((target) => target.remove());
  }, [members]);

  return (
    <>
      <span ref={markerRef} hidden aria-hidden="true" />
      {members.map((member, index) => {
        const target = targets[index];
        return target ? (
          <MemberPresence
            key={member.id}
            accountId={accountId}
            member={member}
            target={target}
          />
        ) : null;
      })}
    </>
  );
};

/** UI-kit ShareModal adapter with every membership mutation switched off. */
export const ChatMembersModal = ({
  chat,
  isOpen,
  onClose,
}: ChatMembersModalProps) => {
  const { t } = useTranslation();
  const { present, pendingInvites, isInitialLoading, isError, refetch } =
    useChatMembers(chat.ref, isOpen);
  const avatarSrc = useMyAvatarSrc(chat.accountId);
  // `present` always sorts the current user first (see `sortChatMembers` in
  // MatrixDriver), so the member list's own row is reliably the first
  // `.c__share-member-item` in the (portaled) members section, in document
  // order — the library gives its `UserRow` no `src` prop to reach it any
  // other way. Not `:first-child`: the section's title div is the actual
  // first child, so that pseudo-class never matches a member row at all.
  useAvatarPortalOverlay(
    ".c__share-modal__members .c__share-member-item .c__avatar",
    isOpen ? avatarSrc : undefined,
  );
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
    >
      <MemberPresencePortals accountId={chat.accountId} members={present} />
    </ShareModal>
  );
};
