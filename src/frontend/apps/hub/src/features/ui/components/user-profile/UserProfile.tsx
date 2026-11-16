import { LanguagePicker, UserMenu } from "@gouvfr-lasuite/ui-components";

import { logout, useAuth } from "@/features/auth/Auth";
import { LoginButton } from "@/features/auth/components/LoginButton";
import { useChatAccountProfile } from "@/features/chat/hooks/useChatAccountProfile";
import { useComposerAccountId } from "@/features/chat/hooks/useChatAccounts";
import { useUserLanguage } from "@/features/language/hooks/useUserLanguage";
import { useSettings } from "@/features/settings/SettingsContext";

const TERMS_OF_SERVICE_URL =
  "https://docs.numerique.gouv.fr/docs/8e298e03-c95f-44c7-be4a-ffb618af1854/";

export const UserProfile = () => {
  const { user, chatUser } = useAuth();
  const settings = useSettings();
  const accountId = useComposerAccountId();
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
  return (
    <div ref={settings.menuRef} className="hub__user-menu">
      <UserMenu
        user={
          accountProfile
            ? { full_name: accountProfile.name, email: accountProfile.subtitle }
            : user
        }
        appSettingsCTA={() => {
          // The menu has no prop to close it: its button toggles it, and gets
          // the focus back before the settings take it.
          settings.menuButton()?.click();
          requestAnimationFrame(() => settings.open("general"));
        }}
        logout={logout}
        termOfServiceUrl={TERMS_OF_SERVICE_URL}
        actions={
          <LanguagePicker
            languages={languages}
            onChange={onChange}
            size="small"
            compact
          />
        }
      />
    </div>
  );
};
