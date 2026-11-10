import { ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRequireAuth } from "@/features/auth/hooks/useRequireAuth";
import { ActiveChatProvider } from "@/features/chat/ActiveChatContext";
import { EncryptionSettingsProvider } from "@/features/chat/EncryptionSettingsContext";
import { useChatEvents } from "@/features/chat/hooks/useChatEvents";
import { useChatNotifications } from "@/features/chat/notifications/useChatNotifications";
import { ConversationSearchModal } from "@/features/chat/search/ConversationSearchModal";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";
import { KeyboardShortcutsModal } from "@/features/shortcuts/KeyboardShortcutsModal";
import { useShortcut } from "@/features/shortcuts/useShortcut";

import { LeftPanel } from "./LeftPanel/LeftPanel";
import { ChatSecurity } from "@/features/chat/components/ChatSecurity";

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
  const activeChatRef = useRef<ChatRef | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const canSearch =
    !!user && entries.some(({ driver }) => driver.supportsConversationSearch);

  // Captured before editors and comboboxes consume their keyboard events.
  useShortcut(
    "searchChats",
    () => {
      setShortcutsOpen(false);
      setSearchOpen(true);
    },
    { enabled: canSearch, capture: true, overModals: true },
  );
  useShortcut(
    "showShortcuts",
    () => {
      setSearchOpen(false);
      setShortcutsOpen((open) => !open);
    },
    { enabled: !!user, capture: true, overModals: true },
  );

  // Single, app-wide real-time subscription for the whole messaging shell:
  // reflects activity in any conversation (not just the open one) into the
  // React Query cache. No-op for drivers without real-time support.
  useChatEvents();
  useChatNotifications(user?.id, activeChatRef);

  if (requireAuth && !user) {
    return null;
  }

  return (
    <EncryptionSettingsProvider>
      <div className="hub__layout">
        <a href="#hub__layout__main" className="hub__layout__skip-link">
          {t("Skip to main content")}
        </a>
        {user && <LeftPanel onSearch={() => setSearchOpen(true)} />}
        {user && searchOpen && (
          <ConversationSearchModal onClose={() => setSearchOpen(false)} />
        )}
        {user && shortcutsOpen && (
          <KeyboardShortcutsModal onClose={() => setShortcutsOpen(false)} />
        )}

        <main
          id="hub__layout__main"
          className="hub__layout__main"
          tabIndex={-1}
        >
          {user && <ChatSecurity />}
          <ActiveChatProvider value={activeChatRef}>
            {children}
          </ActiveChatProvider>
        </main>
      </div>
    </EncryptionSettingsProvider>
  );
};
