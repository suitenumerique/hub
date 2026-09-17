// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserProfile } from "../UserProfile";

let currentUser: { email: string; full_name: string } | null = null;
let driverEntries: Array<{
  accountId: string;
  driver: {
    supportsAvatarUpload: boolean;
    supportsPresence: boolean;
    getCurrentUserId: () => string | null;
  };
}> = [];

vi.mock("@/features/auth/Auth", () => ({
  useAuth: () => ({ user: currentUser }),
}));
vi.mock("@/features/auth/components/LoginButton", () => ({
  LoginButton: () => <button>Login</button>,
}));
vi.mock("@/features/drivers/DriverRegistry", () => ({
  useDriverEntries: () => driverEntries,
}));
vi.mock("@/features/chat/hooks/useMyAvatarSrc", () => ({
  useMyAvatarSrc: () => undefined,
}));
vi.mock("@/features/ui/components/avatar/useAvatarPortalOverlay", () => ({
  useAvatarPortalOverlay: vi.fn(),
}));
vi.mock("../ChangeProfilePhotoAction", () => ({
  ChangeProfilePhotoAction: () => <span>Change photo action</span>,
}));
vi.mock("../LogoutAction", () => ({
  LogoutAction: () => <span>Logout action</span>,
}));
vi.mock("../UserPresenceAction", () => ({
  UserPresenceActions: () => <span>Presence action</span>,
  UserPresenceQuickControl: () => <button>Quick presence</button>,
}));
vi.mock("@gouvfr-lasuite/ui-components", () => ({
  UserMenu: ({ actions }: { actions: ReactNode }) => (
    <div aria-label="User menu">{actions}</div>
  ),
  // The account menu now carries a role entry, which draws its own item.
  UserMenuItem: ({ label }: { label: string }) => <button>{label}</button>,
}));

describe("UserProfile", () => {
  beforeEach(() => {
    currentUser = null;
    driverEntries = [];
  });

  it("keeps the login fallback for an anonymous user", () => {
    render(<UserProfile />);

    expect(screen.queryByRole("button", { name: "Login" })).not.toBeNull();
    expect(screen.queryByLabelText("User menu")).toBeNull();
  });

  it("keeps existing actions and adds presence for a logged-in user", () => {
    currentUser = { email: "alice@test", full_name: "Alice" };
    driverEntries = [
      {
        accountId: "account-a",
        driver: {
          supportsAvatarUpload: true,
          supportsPresence: true,
          getCurrentUserId: () => "@alice:a",
        },
      },
    ];
    render(<UserProfile />);

    expect(screen.queryByLabelText("User menu")).not.toBeNull();
    expect(screen.queryByText("Presence action")).not.toBeNull();
    expect(screen.queryByText("Change photo action")).not.toBeNull();
    expect(screen.queryByText("Logout action")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Quick presence" }),
    ).not.toBeNull();
  });
});
