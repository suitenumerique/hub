import { UserMenu } from "@gouvfr-lasuite/ui-kit";

import { logout, useAuth } from "@/features/auth/Auth";
import { LoginButton } from "@/features/auth/components/LoginButton";

import { LanguagePickerUserMenu } from "./LanguagePickerUserMenu";

const TERMS_OF_SERVICE_URL =
  "https://docs.numerique.gouv.fr/docs/8e298e03-c95f-44c7-be4a-ffb618af1854/";

export const UserProfile = () => {
  const { user } = useAuth();
  if (!user) {
    return <LoginButton />;
  }
  return (
    <UserMenu
      user={user}
      logout={logout}
      termOfServiceUrl={TERMS_OF_SERVICE_URL}
      actions={<LanguagePickerUserMenu />}
    />
  );
};
