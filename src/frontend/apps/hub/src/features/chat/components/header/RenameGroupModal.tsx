import {
  Button,
  Input,
  Modal,
  ModalSize,
} from "@gouvfr-lasuite/cunningham-react";
import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type RenameGroupModalProps = {
  initialName: string;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export const RenameGroupModal = ({
  initialName,
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}: RenameGroupModalProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
    }
  }, [initialName, isOpen]);

  const normalizedName = name.trim();
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!normalizedName || normalizedName === initialName || isSubmitting) {
      return;
    }
    onSubmit(normalizedName);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={ModalSize.SMALL}
      title={t("Rename group")}
      closeOnClickOutside={!isSubmitting}
      closeOnEsc={!isSubmitting}
      preventClose={isSubmitting}
      rightActions={
        <>
          <Button
            type="button"
            variant="secondary"
            color="neutral"
            disabled={isSubmitting}
            onClick={onClose}
          >
            {t("Cancel")}
          </Button>
          <Button
            type="button"
            color="brand"
            disabled={
              !normalizedName || normalizedName === initialName || isSubmitting
            }
            onClick={() => submit()}
          >
            {isSubmitting ? t("Saving…") : t("Save")}
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <Input
          id="rename-group-name"
          fullWidth
          label={t("Group name")}
          value={name}
          maxLength={255}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
      </form>
    </Modal>
  );
};
