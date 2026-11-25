import { Button } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

import type { ChatSecuritySnapshot } from "@/features/drivers/security";

import type { UnlockDevice } from "../../MessageUnlockContext";

import { UnlockCard } from "./UnlockCard";
import { UnlockProgress, type UnlockProgressLine } from "./UnlockProgress";

type UnlockCompletionProps = {
  security: ChatSecuritySnapshot;
  device: UnlockDevice;
  client: string;
  onSkip: () => void;
};

/** From the confirmation on this device to the recovered history. */
export const UnlockCompletion = ({
  security,
  device,
  client,
  onSkip,
}: UnlockCompletionProps) => {
  const { t } = useTranslation();
  const onPhone = device === "phone";
  const isConfirmed = security.verification.phase === "complete";
  const hasKeys = security.trust === "verified" && security.secrets === "ready";

  const lines: UnlockProgressLine[] = [
    { emoji: "💻", label: t("Confirmed on this computer"), done: true },
  ];
  if (!isConfirmed) {
    lines.push({
      emoji: onPhone ? "📱" : "💻",
      label: onPhone
        ? t("Waiting for confirmation from your phone…")
        : t("Waiting for confirmation from the {{client}} tab…", { client }),
    });
  } else {
    lines.push({
      emoji: "📱",
      label: onPhone
        ? t("Confirmed on your phone")
        : t("Confirmed in the {{client}} tab", { client }),
      done: true,
    });
    if (!hasKeys) {
      lines.push({
        emoji: "🔑",
        label: onPhone
          ? t("Receiving the keys from your phone…")
          : t("Receiving the keys from the {{client}} tab…", { client }),
      });
    } else {
      lines.push(
        { emoji: "🔑", label: t("Keys received"), done: true },
        { emoji: "🗂️", label: t("Recovering your message history…") },
      );
    }
  }

  return (
    <UnlockCard
      title={t("Unlocking in progress")}
      step={3}
      // The keys go on arriving without the card.
      actions={
        isConfirmed && (
          <Button variant="tertiary" color="neutral" fullWidth onClick={onSkip}>
            {t("Continue without waiting")}
          </Button>
        )
      }
    >
      <UnlockProgress lines={lines} />
    </UnlockCard>
  );
};
