import { Button } from "@gouvfr-lasuite/ui-components";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { trackEvent } from "@/features/analytics/analytics";
import { FluentEmoji } from "@/features/chat/components/FluentEmoji";
import type { ChatConnectionStep } from "@/features/drivers/Driver";
import { stepContent } from "@/features/layouts/components/AppLoader/AppLoader";
import { SupportLink } from "@/features/layouts/components/SupportLink/SupportLink";

type SlowConnectionProps = {
  /** The step the first chat connection is at, if it reports one. */
  step?: ChatConnectionStep;
};

/**
 * Replaces the splash when the chat takes too long to connect. The connection
 * goes on meanwhile, and the chat opens if it succeeds: trying again is only
 * a fallback, since it restarts a first connection from the beginning.
 */
export const SlowConnection = ({ step }: SlowConnectionProps) => {
  const { t } = useTranslation();
  const content = step && stepContent(t, step);

  useEffect(() => {
    trackEvent("connection:error-shown", { reason: "slow" });
  }, []);

  return (
    <main className="hub__connection-error">
      <h1>{t("Connecting to Tchap is taking longer than expected")}</h1>
      <p role="alert">
        {t(
          "The connection goes on. Keep this page open: your chats will open on their own when it is done.",
        )}
      </p>
      {content && (
        <p className="hub__connection-error__step" role="status">
          <FluentEmoji emoji={content.emoji} size="md" decorative />
          {content.label}
        </p>
      )}
      <p>
        {t(
          "Your chats and keys are not lost. If nothing changes, contact support. Trying again restarts the connection from the beginning.",
        )}
      </p>
      <div className="hub__connection-error__actions">
        <Button variant="secondary" onClick={() => window.location.reload()}>
          {t("Try again")}
        </Button>
        <SupportLink>{t("Contact support")}</SupportLink>
      </div>
    </main>
  );
};
