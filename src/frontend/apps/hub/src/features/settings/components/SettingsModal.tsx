import { Modal, ModalSize, type ModalTab } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

import { EncryptionSettingsContent } from "@/features/chat/components/EncryptionSettingsContent";
import { useComposerAccountId } from "@/features/chat/hooks/useChatAccounts";
import { useEncryptionCommands } from "@/features/chat/hooks/useEncryptionCommands";
import { useMessageUnlock } from "@/features/chat/MessageUnlockContext";

import { type SettingsTab, useSettings } from "../SettingsContext";

import { GeneralSettings } from "./GeneralSettings";

const isSettingsTab = (id: string): id is SettingsTab =>
  id === "general" || id === "encryption";

export const SettingsModal = () => {
  const { t } = useTranslation();
  const settings = useSettings();
  const composerAccountId = useComposerAccountId();
  const accountId = settings.accountId ?? composerAccountId;
  const encryption = useEncryptionCommands(accountId);
  const { session } = useMessageUnlock();

  const tabs: ModalTab[] = [
    {
      id: "general",
      label: t("General", { description: "Settings tab" }),
      title: t("General", { description: "Settings tab" }),
      content: <GeneralSettings />,
    },
  ];
  if (encryption.security.supported) {
    tabs.push({
      id: "encryption",
      label: t("Encryption"),
      title: t("Encryption"),
      content: (
        <EncryptionSettingsContent
          security={encryption.security}
          commandFailed={encryption.commandFailed}
          onCommand={encryption.run}
        />
      ),
    });
  }

  const close = () => {
    encryption.onClose({
      // The unlock card goes on with its own.
      keepVerification: accountId !== null && session?.accountId === accountId,
    });
    settings.close();
  };

  return (
    <Modal
      variant="tab"
      isOpen={settings.tab !== null}
      size={ModalSize.LARGE}
      // The same height for every tab: switching tabs does not resize it.
      constraints={{ preferredHeight: 560 }}
      sidebarTitle={t("Settings")}
      tabs={tabs}
      activeTab={settings.tab ?? undefined}
      onTabChange={(id) => {
        if (isSettingsTab(id)) settings.selectTab(id);
      }}
      onClose={close}
      closeOnClickOutside
      closeOnEsc
    />
  );
};
