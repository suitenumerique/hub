import { Button, Input, Modal, ModalSize } from "@gouvfr-lasuite/ui-components";
import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { spaceHref } from "@/features/chat/chatRefs";
import { useComposerAccountId } from "@/features/chat/hooks/useChatAccounts";
import { useCreateSpace } from "@/features/chat/hooks/useCreateSpace";
import { notify } from "@/features/ui/components/toast";

type CreateSpaceModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

/** Small "name it" dialog for the New menu's "Espace" choice. */
export const CreateSpaceModal = ({
  isOpen,
  onClose,
}: CreateSpaceModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const accountId = useComposerAccountId();
  const { createSpace, isCreating } = useCreateSpace(accountId);
  const [name, setName] = useState("");
  const trimmedName = name.trim();

  const close = () => {
    if (isCreating) return;
    setName("");
    onClose();
  };

  const handleCreate = () => {
    if (!trimmedName || isCreating) return;
    createSpace(trimmedName)
      .then((space) => {
        setName("");
        onClose();
        void router.push(spaceHref(space.id), undefined, { shallow: true });
      })
      .catch(() => {
        notify.error(t("The space could not be created. Please try again."));
      });
  };

  return (
    <Modal
      isOpen={isOpen}
      size={ModalSize.SMALL}
      title={t("New space")}
      aria-label={t("New space")}
      onClose={close}
      closeOnClickOutside={!isCreating}
      closeOnEsc={!isCreating}
      preventClose={isCreating}
      rightActions={
        <>
          <Button
            type="button"
            variant="secondary"
            color="neutral"
            fullWidth
            disabled={isCreating}
            onClick={close}
          >
            {t("Cancel")}
          </Button>
          <Button
            type="button"
            fullWidth
            disabled={isCreating || !trimmedName}
            onClick={handleCreate}
          >
            {isCreating ? t("Creating…") : t("Create")}
          </Button>
        </>
      }
    >
      <Input
        label={t("Space name")}
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleCreate();
          }
        }}
      />
    </Modal>
  );
};
