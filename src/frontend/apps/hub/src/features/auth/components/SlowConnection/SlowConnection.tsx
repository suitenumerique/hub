import { Button } from "@gouvfr-lasuite/ui-components";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { trackEvent } from "@/features/analytics/analytics";
import { SupportLink } from "@/features/layouts/components/SupportLink/SupportLink";

/**
 * Replaces the splash when the chat takes too long to connect. The connection
 * goes on meanwhile, and the chat opens if it succeeds.
 */
export const SlowConnection = () => {
  const { t } = useTranslation();

  useEffect(() => {
    trackEvent("connection:error-shown", { reason: "slow" });
  }, []);

  return (
    <main className="hub__connection-error">
      <h1>{t("Connecting to Tchap is taking longer than expected")}</h1>
      <p role="alert">
        {t(
          "Your chats and keys are not lost. Try again in a moment. If the problem persists, contact support.",
        )}
      </p>
      <div className="hub__connection-error__actions">
        <Button onClick={() => window.location.reload()}>
          {t("Try again")}
        </Button>
        <SupportLink>{t("Contact support")}</SupportLink>
      </div>
    </main>
  );
};
