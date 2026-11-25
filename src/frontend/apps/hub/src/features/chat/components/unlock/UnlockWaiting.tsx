import { Button, Spinner } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

import { renderEmojiText } from "../../formattedContent";

import { UnlockCard } from "./UnlockCard";
import { UnlockProgress, type UnlockProgressLine } from "./UnlockProgress";

type UnlockWaitingProps = {
  client: string;
  /** The request left this device. */
  isRequestSent: boolean;
  onCancel: () => void;
};

/** The phone has to accept the request before both devices show the emojis. */
export const UnlockPhoneWaiting = ({
  client,
  isRequestSent,
  onCancel,
}: UnlockWaitingProps) => {
  const { t } = useTranslation();

  return (
    <UnlockCard
      title={t("Compare the emojis")}
      text={t(
        "Accept the request in the {{client}} app on your phone: the emojis will show here.",
        { client },
      )}
      step={2}
      actions={
        <Button variant="tertiary" color="neutral" fullWidth onClick={onCancel}>
          {t("Cancel verification")}
        </Button>
      }
    >
      <div className="hub__message-unlock__waiting" role="status">
        <span aria-hidden="true">
          <Spinner size="sm" />
        </span>
        {isRequestSent
          ? t("Waiting for your phone…")
          : t("Sending the request…")}
      </div>
    </UnlockCard>
  );
};

export const UnlockTabWaiting = ({
  client,
  isRequestSent,
  onCancel,
}: UnlockWaitingProps) => {
  const { t } = useTranslation();
  const lines: UnlockProgressLine[] = isRequestSent
    ? [
        { emoji: "💻", label: t("Request sent"), done: true },
        {
          emoji: "💻",
          label: t("Waiting for the emojis in the {{client}} tab…", {
            client,
          }),
        },
      ]
    : [{ emoji: "💻", label: t("Sending the request…") }];

  return (
    <UnlockCard
      title={t("Open {{client}} in another tab", { client })}
      text={renderEmojiText(
        t(
          "Open {{client}}, already signed in to your account, in a new tab: the emojis will show there. This tab will be called “🔐 To confirm”.",
          { client },
        ),
      )}
      step={1}
      actions={
        <Button variant="tertiary" color="neutral" fullWidth onClick={onCancel}>
          {t("Use my phone instead")}
        </Button>
      }
    >
      <UnlockProgress lines={lines} />
    </UnlockCard>
  );
};
