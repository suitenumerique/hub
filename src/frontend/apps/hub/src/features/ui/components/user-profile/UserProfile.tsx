import { UserMenu } from "@gouvfr-lasuite/ui-components";
import { useState } from "react";

import { useAuth } from "@/features/auth/Auth";
import { LoginButton } from "@/features/auth/components/LoginButton";
import { useMyAvatarSrc } from "@/features/chat/hooks/useMyAvatarSrc";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import { RoleProfileAction } from "@/features/roles/RoleProfileAction";

import { useAvatarPortalOverlay } from "../avatar/useAvatarPortalOverlay";
import { ChangeProfilePhotoAction } from "./ChangeProfilePhotoAction";
import { LogoutAction } from "./LogoutAction";
import {
  UserPresenceActions,
  UserPresenceQuickControl,
} from "./UserPresenceAction";

export const UserProfile = () => {
  const { user } = useAuth();
  const [menuVersion, setMenuVersion] = useState(0);
  // `UserMenu`'s own avatar only ever renders initials — there's no prop to
  // give it a photo — so the real photo is layered on top as a plain `<img>`
  // absolutely positioned over its trigger button (see UserProfile.scss).
  const entries = useDriverEntries();
  const avatarAccount = entries.find(
    (entry) => entry.driver.supportsAvatarUpload,
  );
  const presenceAccount = entries.find(
    (entry) =>
      entry.driver.supportsPresence && entry.driver.getCurrentUserId() !== null,
  );
  const presenceUserId = presenceAccount?.driver.getCurrentUserId() ?? null;
  const avatarSrc = useMyAvatarSrc(avatarAccount?.accountId ?? "");
  // The popover header (name + email, opened from the trigger) is portaled
  // straight to `document.body` by the library — outside this component's
  // DOM — so it needs the portal-patching variant instead of a plain overlay.
  useAvatarPortalOverlay(
    ".user-menu__content__body__user-info .c__avatar",
    avatarSrc,
  );

  if (!user) {
    return <LoginButton />;
  }
  return (
    <div className="hub__user-profile">
      <UserMenu
        // The UI kit menu is uncontrolled. Remount it closed before the role
        // dialog opens so its popover does not trap focus behind the dialog.
        key={menuVersion}
        user={user}
        // Not using `UserMenu`'s own `logout` prop: it always renders in a
        // fixed slot above `actions`; keeping it here lets presence, photo and
        // logout follow the product-defined order in one list.
        actions={
          <>
            <UserPresenceActions />
            <ChangeProfilePhotoAction />
            <RoleProfileAction
              onOpen={() => setMenuVersion((version) => version + 1)}
            />
            <LogoutAction />
          </>
        }
      />
      {avatarSrc && (
        <img
          src={avatarSrc}
          alt=""
          aria-hidden="true"
          className="hub__user-profile__avatar"
        />
      )}
      {presenceAccount && presenceUserId && (
        <UserPresenceQuickControl
          accountId={presenceAccount.accountId}
          userId={presenceUserId}
        />
      )}
    </div>
  );
};
