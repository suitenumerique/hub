import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import { TchapLogo } from "@/features/layouts/LeftPanel/TchapLogo";

const subscribeToNothing = () => () => {};

/**
 * Full-page splash shown while the configuration, the Hub session and the chat
 * connection load. The static export pre-renders it, so it is also the first
 * paint before any script runs.
 */
export const AppLoader = () => {
  const { t } = useTranslation();
  // The pre-rendered page only knows the default language: the label appears
  // after hydration so it never mismatches the visitor's language.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  return (
    <div
      className="hub__app-loader"
      role="status"
      aria-busy="true"
      aria-label={hydrated ? t("Loading…") : undefined}
    >
      <TchapLogo size="large" />
      <span className="hub__app-loader__bar" aria-hidden="true" />
    </div>
  );
};
