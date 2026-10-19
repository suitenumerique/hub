import { Button, Modal, ModalSize } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

type ExternalServerModalProps = {
  /** Email leading to the external server; the modal is open while set. */
  email: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Confirms signing in to the server of external guests, as Tchap web does:
 * unknown and mistyped email domains also lead there.
 */
export const ExternalServerModal = ({
  email,
  onCancel,
  onConfirm,
}: ExternalServerModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={email !== null}
      size={ModalSize.SMALL}
      title={t("Are you an external guest?")}
      aria-label={t("Are you an external guest?")}
      onClose={onCancel}
      rightActions={
        <>
          <Button
            type="button"
            variant="secondary"
            color="neutral"
            fullWidth
            onClick={onCancel}
          >
            {t("Cancel")}
          </Button>
          <Button type="button" fullWidth onClick={onConfirm}>
            {t("Continue")}
          </Button>
        </>
      }
    >
      {t(
        "If you are not, check that your email address {{email}} has no typo.",
        {
          email,
        },
      )}
    </Modal>
  );
};
