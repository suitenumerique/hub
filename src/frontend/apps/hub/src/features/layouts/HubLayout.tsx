import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRequireAuth } from "@/features/auth/hooks/useRequireAuth";
import { useChatEvents } from "@/features/chat/hooks/useChatEvents";
import { useChatNotifications } from "@/features/chat/notifications/useChatNotifications";
import { ConversationSearchModal } from "@/features/chat/search/ConversationSearchModal";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";

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
  const entries = useDriverEntries();
  const [searchOpen, setSearchOpen] = useState(false);
  const canSearch =
    !!user && entries.some(({ driver }) => driver.supportsConversationSearch);

  useEffect(() => {
    if (!canSearch) return;
    const openSearch = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.altKey ||
        event.shiftKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k"
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setSearchOpen(true);
    };
    // Capture before editors and comboboxes consume their keyboard events.
    window.addEventListener("keydown", openSearch, true);
    return () => window.removeEventListener("keydown", openSearch, true);
  }, [canSearch]);

  // Single, app-wide real-time subscription for the whole messaging shell:
  // reflects activity in any conversation (not just the open one) into the
  // React Query cache. No-op for drivers without real-time support.
  useChatEvents();
  useChatNotifications(user?.id);

  if (requireAuth && !user) {
    return null;
  }

  return (
    <div className="hub__layout">
      <a href="#hub__layout__main" className="hub__layout__skip-link">
        {t("Skip to main content")}
      </a>
      {user && <LeftPanel onSearch={() => setSearchOpen(true)} />}
      {user && searchOpen && (
        <ConversationSearchModal onClose={() => setSearchOpen(false)} />
      )}

      <main id="hub__layout__main" className="hub__layout__main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
};
