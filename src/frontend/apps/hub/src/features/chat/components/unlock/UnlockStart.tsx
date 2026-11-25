import { Button } from "@gouvfr-lasuite/ui-components";
import { ArrowUpRight } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import type { UnlockDevice } from "../../MessageUnlockContext";

import { UnlockCard } from "./UnlockCard";
import { UnlockIllustration } from "./UnlockIllustration";

type UnlockStartProps = {
  client: string;
  hasFailed: boolean;
  onStart: (device: UnlockDevice) => void;
  canOpenClient: boolean;
};

/** Chooses the device that will show the emojis. */
export const UnlockStart = ({
  client,
  hasFailed,
  onStart,
  canOpenClient,
}: UnlockStartProps) => {
  const { t } = useTranslation();

  return (
    <UnlockCard
      title={t("Unlock your messages")}
      text={t(
        "Take your phone and open the {{client}} app, already signed in to your account.",
        { client },
      )}
      step={1}
      hasFailed={hasFailed}
      actions={
        <>
          <Button fullWidth onClick={() => onStart("phone")}>
            {t("Compare with my phone")}
          </Button>
          {canOpenClient && (
            <Button
              variant="tertiary"
              color="neutral"
              fullWidth
              onClick={() => onStart("tab")}
            >
              {t("Open {{client}} on my computer", { client })}
            </Button>
          )}
        </>
      }
    >
      <UnlockIllustration />
    </UnlockCard>
  );
};

type UnlockSetupProps = {
  client: string;
  /** The account has no encryption yet, rather than no other device. */
  isIdentityMissing: boolean;
  onOpenClient?: () => void;
};

/** No other device can show the emojis: the client comes first. */
export const UnlockSetup = ({
  client,
  isIdentityMissing,
  onOpenClient,
}: UnlockSetupProps) => {
  const { t } = useTranslation();

  return (
    <UnlockCard
      title={t("Unlock your messages")}
      text={
        isIdentityMissing
          ? t(
              "Set up encryption in {{client}}, then return here to verify this device.",
              { client },
            )
          : t(
              "First sign in to {{client}} with the same account and set up encryption there.",
              { client },
            )
      }
      actions={
        onOpenClient && (
          <Button
            fullWidth
            icon={<ArrowUpRight aria-hidden="true" />}
            iconPosition="right"
            onClick={onOpenClient}
          >
            {t("Open {{client}}", { client })}
          </Button>
        )
      }
    />
  );
};
