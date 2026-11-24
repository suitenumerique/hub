import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ChatRef } from "@/features/drivers/types";

import { useUpdateGroup } from "../hooks/useGroupMutations";
import type { Group } from "../types";

import { GroupFormModal, type GroupFormValues } from "./GroupFormModal";

type GroupSettingsModalProps = {
  group: Group;
  /** The group's conversation. */
  chatRef: ChatRef;
  isOpen: boolean;
  onClose: () => void;
};

/** Edits the group's emoji and name (#33): the creation modal, prefilled. */
export const GroupSettingsModal = ({
  group,
  chatRef,
  isOpen,
  onClose,
}: GroupSettingsModalProps) => {
  const { t } = useTranslation();
  const updateGroup = useUpdateGroup(group.id, chatRef);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initialValues = useMemo<GroupFormValues>(
    () => ({ name: group.name, emoji: group.emoji }),
    [group.emoji, group.name],
  );

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
    }
  }, [isOpen]);

  const submit = ({ name, emoji }: GroupFormValues) => {
    setErrorMessage(null);
    updateGroup.mutate(
      { name, emoji },
      {
        onSuccess: onClose,
        onError: () => {
          setErrorMessage(t("The group could not be saved. Please try again."));
        },
      },
    );
  };

  return (
    <GroupFormModal
      isOpen={isOpen}
      title={t("Group settings")}
      submitLabel={t("Save")}
      pendingLabel={t("Saving…")}
      initialValues={initialValues}
      isPending={updateGroup.isPending}
      errorMessage={errorMessage}
      onSubmit={submit}
      onClose={onClose}
    />
  );
};
