import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useRequireAuth } from "@/features/auth/hooks/useRequireAuth";

import { LeftPanel } from "./LeftPanel/LeftPanel";

type HubLayoutProps = {
  children: ReactNode;
  /**
   * When `false`, the layout renders for anonymous users too and the LeftPanel
   * is hidden. Used by error pages (401/403) so they remain reachable without
   * triggering a redirect to /home — which would defeat their purpose.
   */
  requireAuth?: boolean;
};

export const HubLayout = ({ children, requireAuth = true }: HubLayoutProps) => {
  const { t } = useTranslation();
  const user = useRequireAuth(requireAuth);

  if (requireAuth && !user) {
    return null;
  }

  return (
    <div className="hub__layout">
      <a href="#hub__layout__main" className="hub__layout__skip-link">
        {t("Skip to main content")}
      </a>
      {user && <LeftPanel />}

      <main id="hub__layout__main" className="hub__layout__main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
};
