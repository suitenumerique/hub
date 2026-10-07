import {
  DropdownMenu,
  UserAvatar,
  useDropdownMenu,
} from "@gouvfr-lasuite/ui-components";
import { Key, Logout } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import { logout, useAuth } from "@/features/auth/Auth";
import { LoginButton } from "@/features/auth/components/LoginButton";
import { ChatUserAvatar } from "@/features/chat/components/ChatUserAvatar";
import { useEncryptionSettings } from "@/features/chat/EncryptionSettingsContext";
import { useChatAccountProfile } from "@/features/chat/hooks/useChatAccountProfile";
import { useComposerAccountId } from "@/features/chat/hooks/useChatAccounts";
import { useChatSecurity } from "@/features/chat/hooks/useChatSecurity";
import type { AccountId, ChatUser, User } from "@/features/drivers/types";
import { useUserLanguage } from "@/features/language/hooks/useUserLanguage";

const TERMS_OF_SERVICE_URL =
  "https://docs.numerique.gouv.fr/docs/8e298e03-c95f-44c7-be4a-ffb618af1854/";

type IdentityAvatarProps = {
  accountId: AccountId | null;
  accountProfile: ChatUser | null;
  user: User;
  size: "small" | "medium";
};

/** The account's own picture when it has an identity, else the Hub user's. */
const IdentityAvatar = ({
  accountId,
  accountProfile,
  user,
  size,
}: IdentityAvatarProps) =>
  accountProfile ? (
    <ChatUserAvatar
      accountId={accountId}
      user={accountProfile}
      size={size === "small" ? "sm" : "md"}
    />
  ) : (
    <UserAvatar fullName={user.full_name || user.email} size={size} />
  );

export const UserProfile = () => {
  const { user, chatUser } = useAuth();
  const { t } = useTranslation();
  const menu = useDropdownMenu();
  const settings = useEncryptionSettings();
  const accountId = useComposerAccountId();
  const { security } = useChatSecurity(accountId);
  const { languages, onChange } = useUserLanguage();
  // A Tchap account is its own identity: show its profile once loaded. Local
  // Matrix accounts come from the Hub's identity provider, so the Hub user is
  // the same person.
  const accountProfile = useChatAccountProfile(
    accountId,
    chatUser?.userId ?? null,
  );
  if (!user) {
    return <LoginButton />;
  }
  const name = accountProfile ? accountProfile.name : user.full_name;
  const detail = accountProfile ? accountProfile.subtitle : user.email;
  return (
    <DropdownMenu
      isOpen={menu.isOpen}
      onOpenChange={menu.setIsOpen}
      variant="tiny"
      topMessage={
        <div className="hub__user-menu-identity">
          <IdentityAvatar
            accountId={accountId}
            accountProfile={accountProfile}
            user={user}
            size="medium"
          />
          <div>
            {name && <strong>{name}</strong>}
            <span>{detail}</span>
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
            value: language.value,
            isChecked: language.isChecked,
            testId: "hub-user-menu-language-option",
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
        <IdentityAvatar
          accountId={accountId}
          accountProfile={accountProfile}
          user={user}
          size="small"
        />
      </button>
    </DropdownMenu>
  );
};
