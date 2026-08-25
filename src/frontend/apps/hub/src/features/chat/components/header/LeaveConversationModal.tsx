import { Button, Modal, ModalSize } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

type LeaveConversationModalProps = {
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** Destructive confirmation for leaving and forgetting one conversation. */
export const LeaveConversationModal = ({
  isOpen,
  isPending,
  onClose,
  onConfirm,
}: LeaveConversationModalProps) => {
  const { t } = useTranslation();
  const close = () => {
    if (!isPending) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      size={ModalSize.SMALL}
      title={t("Leave conversation?")}
      aria-label={t("Leave conversation?")}
      onClose={close}
      closeOnClickOutside={!isPending}
      closeOnEsc={!isPending}
      preventClose={isPending}
      rightActions={
        <>
          <Button
            type="button"
            variant="secondary"
            color="neutral"
            fullWidth
            disabled={isPending}
            onClick={close}
          >
            {t("Cancel")}
          </Button>
          <Button
            type="button"
            color="error"
            fullWidth
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? t("Leaving…") : t("Leave conversation")}
          </Button>
        </>
      }
    >
      {t(
        "The conversation and its history will be removed from this account. Other participants will keep the conversation and its history.",
      )}
    </Modal>
  );
};
