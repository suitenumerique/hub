import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { AccountId, ChatUser } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { useCreateGroup } from "../hooks/useGroupMutations";
import { useOpenGroupConversation } from "../hooks/useOpenGroupConversation";

import {
  DEFAULT_GROUP_EMOJI,
  GroupFormModal,
  type GroupFormValues,
} from "./GroupFormModal";

const NEW_GROUP: GroupFormValues = { name: "", emoji: DEFAULT_GROUP_EMOJI };

type CreateGroupModalProps = {
  isOpen: boolean;
  /** Chat account the group conversation is created on. */
  accountId: AccountId | null;
  /** The people chosen in the search, the current user excluded. */
  invitees: ChatUser[];
  onClose: () => void;
  onCreated: () => void;
};

/** Creates a group with the people chosen in the New chat search (#32). */
export const CreateGroupModal = ({
  isOpen,
  accountId,
  invitees,
  onClose,
  onCreated,
}: CreateGroupModalProps) => {
  const { t } = useTranslation();
  const createGroup = useCreateGroup();
  const openGroupConversation = useOpenGroupConversation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
    }
  }, [isOpen]);

  const submit = ({ name, emoji }: GroupFormValues) => {
    if (!accountId) {
      return;
    }
    setErrorMessage(null);
    createGroup.mutate(
      {
        matrix_account_id: accountId,
        name,
        emoji,
        invitees: invitees.map((user) => user.id),
      },
      {
        onSuccess: (group) => {
          onCreated();
          if (!group?.matrix) {
            return;
          }
          openGroupConversation({
            accountId,
            chatId: group.matrix.room_id,
          }).catch(() => {
            notify.error(
              t(
                "The group was created, but its conversation could not be opened.",
              ),
            );
          });
        },
        onError: () => {
          setErrorMessage(
            t("The group could not be created. Please try again."),
          );
        },
      },
    );
  };

  return (
    <GroupFormModal
      isOpen={isOpen}
      title={t("Create a group")}
      submitLabel={t("Create")}
      pendingLabel={t("Creating…")}
      initialValues={NEW_GROUP}
      isPending={createGroup.isPending}
      errorMessage={errorMessage}
      onSubmit={submit}
      onClose={onClose}
    />
  );
};
