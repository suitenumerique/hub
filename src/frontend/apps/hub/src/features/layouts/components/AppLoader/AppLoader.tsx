import { QuestionMark } from "@gouvfr-lasuite/ui-components/icons";
import type { TFunction } from "i18next";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import { FluentEmoji } from "@/features/chat/components/FluentEmoji";
import type { ChatConnectionStep } from "@/features/drivers/Driver";
import { SupportLink } from "@/features/layouts/components/SupportLink/SupportLink";
import { TchapLogo } from "@/features/layouts/LeftPanel/TchapLogo";

const subscribeToNothing = () => () => {};

/** What a step of the first chat connection shows. */
export const stepContent = (
  t: TFunction,
  step: ChatConnectionStep,
): { emoji: string; label: string } => {
  switch (step) {
    case "signing-in":
      return { emoji: "🔑", label: t("Connecting to your Tchap account…") };
    case "preparing":
      return { emoji: "🧰", label: t("Preparing your workspace…") };
    case "loading-chats":
      return { emoji: "📋", label: t("Retrieving your list of chats…") };
  }
};

type AppLoaderProps = {
  /** Set during a first chat connection, which can last minutes. */
  step?: ChatConnectionStep;
};

/**
 * Full-page splash shown while the configuration, the Hub session and the chat
 * connection load. The static export pre-renders it, so it is also the first
 * paint before any script runs.
 */
export const AppLoader = ({ step }: AppLoaderProps) => {
  const { t } = useTranslation();
  // The pre-rendered page only knows the default language: the label appears
  // after hydration so it never mismatches the visitor's language.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const content = step && stepContent(t, step);

  return (
    <div className="hub__app-loader">
      <TchapLogo size="large" />
      <div className="hub__app-loader__progress">
        <span className="hub__app-loader__bar" aria-hidden="true" />
        <div className="hub__app-loader__text">
          {/* Always there, so that each step is announced. */}
          <p className="hub__app-loader__status" role="status">
            {content ? (
              <span key={step} className="hub__app-loader__step">
                <FluentEmoji emoji={content.emoji} size="md" decorative />
                {content.label}
              </span>
            ) : (
              hydrated && (
                <span className="hub__visually-hidden">{t("Loading…")}</span>
              )
            )}
          </p>
          {content && (
            <p className="hub__app-loader__patience">
              {t("The first connection can take a few minutes.")}
            </p>
          )}
        </div>
      </div>
      {content && (
        <div className="hub__app-loader__help">
          <SupportLink size="small" icon={<QuestionMark size={16} />}>
            {t("Need help? Contact support")}
          </SupportLink>
        </div>
      )}
    </div>
  );
};
