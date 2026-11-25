import { Button } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

import type { ChatSecuritySnapshot } from "@/features/drivers/security";
import { SupportLink } from "@/features/layouts/components/SupportLink/SupportLink";

import { UnlockCard } from "./UnlockCard";

type UnlockFailureProps = {
  verification: ChatSecuritySnapshot["verification"];
  hasFailed: boolean;
  onRestart: () => void;
};

/** Nothing was unlocked: says why, and starts again. */
export const UnlockFailure = ({
  verification,
  hasFailed,
  onRestart,
}: UnlockFailureProps) => {
  const { t } = useTranslation();
  const isMismatch =
    verification.phase === "cancelled" && verification.mismatch === true;

  const reason = () => {
    if (isMismatch) {
      return t(
        "For your safety, nothing was unlocked. Start again. If it happens again, contact support.",
      );
    }
    switch (verification.phase) {
      case "expired":
        return t("The request has expired. You can try again.");
      case "cancelled":
        return t("Verification has been cancelled.");
      default:
        return t(
          "Verification failed. Check the connection on both devices and try again.",
        );
    }
  };

  return (
    <UnlockCard
      title={
        isMismatch
          ? t("The emojis did not match")
          : t("Your messages are still locked")
      }
      text={reason()}
      step={2}
      hasFailed={hasFailed}
      actionsLayout="end"
      actions={
        <>
          <SupportLink variant="bordered">{t("Contact support")}</SupportLink>
          <Button onClick={onRestart}>{t("Start again")}</Button>
        </>
      }
    />
  );
};
