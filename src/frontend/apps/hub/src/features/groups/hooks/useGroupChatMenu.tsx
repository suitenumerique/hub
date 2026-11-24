import type { DropdownMenuItem } from "@gouvfr-lasuite/ui-components";
import { Settings } from "@gouvfr-lasuite/ui-components/icons";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import type { Chat } from "@/features/drivers/types";

import { GroupMembersModal } from "../components/GroupMembersModal";
import { GroupSettingsModal } from "../components/GroupSettingsModal";

import { useGroupForChat } from "./useGroups";

type GroupChatMenu = {
  /** Entries to add to the conversation menu. */
  items: DropdownMenuItem[];
  /** Opens the group members instead of the conversation ones, for a group. */
  openMembers: (() => void) | null;
  modals: ReactNode;
};

/**
 * What a group adds to its conversation header: the group settings for an
 * administrator, and the group members. Other conversations get nothing.
 */
export const useGroupChatMenu = (chat: Chat): GroupChatMenu => {
  const { t } = useTranslation();
  const group = useGroupForChat(chat);
  const [openModal, setOpenModal] = useState<"settings" | "members" | null>(
    null,
  );

  useEffect(() => {
    setOpenModal(null);
  }, [chat.ref.accountId, chat.ref.chatId]);

  const canEdit = group?.user_role === "administrator";
  const items = useMemo<DropdownMenuItem[]>(
    () =>
      canEdit
        ? [
            {
              id: "group-settings",
              label: t("Group settings"),
              icon: <Settings />,
              callback: () => setOpenModal("settings"),
            },
          ]
        : [],
    [canEdit, t],
  );

  const openMembers = useCallback(() => setOpenModal("members"), []);

  return {
    items,
    openMembers: group ? openMembers : null,
    modals: group ? (
      <>
        <GroupSettingsModal
          group={group}
          chatRef={chat.ref}
          isOpen={openModal === "settings"}
          onClose={() => setOpenModal(null)}
        />
        <GroupMembersModal
          group={group}
          chatRef={chat.ref}
          isOpen={openModal === "members"}
          onClose={() => setOpenModal(null)}
        />
      </>
    ) : null,
  };
};
