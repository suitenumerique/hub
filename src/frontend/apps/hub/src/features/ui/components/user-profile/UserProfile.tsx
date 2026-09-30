import {
  DropdownMenu,
  UserAvatar,
  useDropdownMenu,
} from "@gouvfr-lasuite/ui-components";
import { Key, Logout } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import { logout, useAuth } from "@/features/auth/Auth";
import { LoginButton } from "@/features/auth/components/LoginButton";
import { useEncryptionSettings } from "@/features/chat/EncryptionSettingsContext";
import { useComposerAccountId } from "@/features/chat/hooks/useChatAccounts";
import { useChatSecurity } from "@/features/chat/hooks/useChatSecurity";

import { useUserLanguage } from "./LanguagePickerUserMenu";

const TERMS_OF_SERVICE_URL =
  "https://docs.numerique.gouv.fr/docs/8e298e03-c95f-44c7-be4a-ffb618af1854/";

export const UserProfile = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const menu = useDropdownMenu();
  const settings = useEncryptionSettings();
  const accountId = useComposerAccountId();
  const { security } = useChatSecurity(accountId);
  const { languages, onChange } = useUserLanguage();
  if (!user) {
    return <LoginButton />;
  }
  return (
    <DropdownMenu
      isOpen={menu.isOpen}
      onOpenChange={menu.setIsOpen}
      variant="tiny"
      topMessage={
        <div className="hub__user-menu-identity">
          <UserAvatar fullName={user.full_name || user.email} />
          <div>
            {user.full_name && <strong>{user.full_name}</strong>}
            <span>{user.email}</span>
          </div>
        </div>
      }
      options={[
        {
          label: t("Encryption"),
          icon: <Key aria-hidden="true" />,
          isHidden: !security.supported,
          callback: () => {
            menu.setIsOpen(false);
            // Let the dropdown restore focus before the modal takes it.
            requestAnimationFrame(() => {
              if (accountId) settings.open(accountId);
            });
          },
        },
        {
          label: t("Logout"),
          icon: <Logout aria-hidden="true" />,
          callback: logout,
        },
        {
          label:
            languages.find((language) => language.isChecked)?.shortLabel ??
            "EN",
          testId: "hub-user-menu-language",
          children: languages.map((language) => ({
            label: language.label,
            icon: language.isChecked ? (
              <span className="material-icons" aria-hidden="true">
                check
              </span>
            ) : undefined,
            callback: () => onChange(language.value),
          })),
        },
        {
          label: t("Terms of service"),
          testId: "hub-user-menu-terms",
          opensInNewWindow: true,
          callback: () => {
            window.open(TERMS_OF_SERVICE_URL, "_blank", "noopener,noreferrer");
          },
        },
      ]}
    >
      <button
        type="button"
        className="user-menu__button hub__user-menu-trigger"
        ref={settings.menuTriggerRef}
        onClick={() => menu.setIsOpen(!menu.isOpen)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            menu.setIsOpen(true);
          }
        }}
        aria-expanded={menu.isOpen}
        aria-haspopup="menu"
        aria-label={t("Account menu")}
      >
        <UserAvatar fullName={user.full_name || user.email} size="small" />
      </button>
    </DropdownMenu>
  );
};
