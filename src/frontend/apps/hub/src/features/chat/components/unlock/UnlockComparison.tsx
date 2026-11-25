import { Button } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

import type {
  ChatSecurityCommand,
  ChatSecuritySnapshot,
} from "@/features/drivers/security";

import type { UnlockDevice } from "../../MessageUnlockContext";
import { SasComparison } from "../SasComparison";

import { UnlockCard } from "./UnlockCard";

type UnlockComparisonProps = {
  verification: ChatSecuritySnapshot["verification"];
  device: UnlockDevice;
  client: string;
  hasFailed: boolean;
  onCommand: (command: ChatSecurityCommand) => void;
  onCancel: () => void;
};

export const UnlockComparison = ({
  verification: { attempt, emojis, decimals },
  device,
  client,
  hasFailed,
  onCommand,
  onCancel,
}: UnlockComparisonProps) => {
  const { t } = useTranslation();

  return (
    <UnlockCard
      title={t("Compare the emojis")}
      text={
        device === "phone"
          ? t("Check that your phone shows the same emojis, in the same order.")
          : t(
              "Check that the {{client}} tab shows the same emojis, in the same order.",
              { client },
            )
      }
      step={2}
      hasFailed={hasFailed}
      actionsLayout="spread"
      actions={
        emojis || decimals ? (
          <>
            <Button
              variant="bordered"
              color="neutral"
              onClick={() => onCommand({ type: "mismatch", attempt })}
            >
              {t("They do not match")}
            </Button>
            <Button onClick={() => onCommand({ type: "match", attempt })}>
              {t("They match")}
            </Button>
          </>
        ) : (
          <Button variant="bordered" color="neutral" onClick={onCancel}>
            {t("Cancel verification")}
          </Button>
        )
      }
    >
      <SasComparison emojis={emojis} decimals={decimals} />
    </UnlockCard>
  );
};
