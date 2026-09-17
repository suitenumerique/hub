// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  UserPresenceAction,
  UserPresenceActions,
  UserPresenceQuickControl,
} from "../UserPresenceAction";

const { setSelfPresencePreference } = vi.hoisted(() => ({
  setSelfPresencePreference: vi.fn(),
}));
let isPending = false;
let preference: "online" | "offline" | null = "online";
let effectivePresence: "online" | "unavailable" | "offline" | null = "online";
let driverEntries: Array<{
  accountId: string;
  label: string;
  driver: {
    supportsPresence: boolean;
    getCurrentUserId: () => string | null;
  };
}> = [];

vi.mock("@/features/chat/hooks/useChatSelfPresencePreference", () => ({
  useChatSelfPresencePreference: () => preference,
}));
vi.mock("@/features/chat/hooks/useSetSelfPresencePreference", () => ({
  useSetSelfPresencePreference: () => ({
    setSelfPresencePreference,
    isPending,
  }),
}));
vi.mock("@/features/chat/hooks/useChatUserPresence", () => ({
  useChatUserPresence: () =>
    effectivePresence ? { userId: "@alice:a", state: effectivePresence } : null,
}));
vi.mock("@/features/drivers/DriverRegistry", () => ({
  useDriverEntries: () => driverEntries,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { account?: string }) =>
      values?.account ? key.replace("{{account}}", values.account) : key,
  }),
}));
vi.mock("@gouvfr-lasuite/ui-components", () => ({
  DropdownMenu: ({
    children,
    onSelectValue,
    options,
  }: {
    children: ReactNode;
    onSelectValue: (value: string) => void;
    options: Array<{
      label: string;
      value: string;
      isDisabled?: boolean;
      isChecked?: boolean;
    }>;
  }) => (
    <div>
      {children}
      {options.map((option) => (
        <button
          key={option.value}
          disabled={option.isDisabled}
          aria-pressed={option.isChecked}
          onClick={() => onSelectValue(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
  UserMenuItem: ({
    icon,
    label,
    onClick,
  }: {
    icon: ReactNode;
    label: string;
    onClick: () => void;
  }) => (
    <button onClick={onClick}>
      {icon}
      {label}
    </button>
  ),
}));

describe("UserPresenceAction", () => {
  beforeEach(() => {
    isPending = false;
    preference = "online";
    effectivePresence = "online";
    driverEntries = [];
    setSelfPresencePreference.mockReset();
    setSelfPresencePreference.mockImplementation((state) => {
      preference = state;
    });
  });

  it.each([
    ["Online", "online"],
    ["Offline", "offline"],
  ] as const)("publishes %s as the %s preference", (label, state) => {
    render(
      <UserPresenceAction
        accountId="account-a"
        accountLabel="Account A"
        showAccountLabel={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(setSelfPresencePreference).toHaveBeenCalledWith(state);
  });

  it("offers neither unavailable nor busy and disables while pending", () => {
    isPending = true;
    render(
      <UserPresenceAction
        accountId="account-a"
        accountLabel="Account A"
        showAccountLabel={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Busy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Away" })).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Online" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Online" }));
    expect(setSelfPresencePreference).not.toHaveBeenCalled();
  });

  it("reflects a successful client selection in the checked option", () => {
    const { rerender } = render(
      <UserPresenceAction
        accountId="account-a"
        accountLabel="Account A"
        showAccountLabel={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Offline" }));
    rerender(
      <UserPresenceAction
        accountId="account-a"
        accountLabel="Account A"
        showAccountLabel={false}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: "Offline" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("keeps the previous checked option when publication does not change it", () => {
    setSelfPresencePreference.mockImplementation(() => {});
    const { rerender } = render(
      <UserPresenceAction
        accountId="account-a"
        accountLabel="Account A"
        showAccountLabel={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Offline" }));
    rerender(
      <UserPresenceAction
        accountId="account-a"
        accountLabel="Account A"
        showAccountLabel={false}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: "Online" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("renders one labeled action per connected capable account", () => {
    driverEntries = [
      {
        accountId: "account-a",
        label: "Account A",
        driver: {
          supportsPresence: true,
          getCurrentUserId: () => "@alice:a",
        },
      },
      {
        accountId: "account-b",
        label: "Account B",
        driver: {
          supportsPresence: true,
          getCurrentUserId: () => "@alice:b",
        },
      },
      {
        accountId: "disconnected",
        label: "Disconnected",
        driver: {
          supportsPresence: true,
          getCurrentUserId: () => null,
        },
      },
    ];

    render(<UserPresenceActions />);

    expect(
      screen.queryByRole("button", { name: "Availability — Account A" }),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Availability — Account B" }),
    ).not.toBeNull();
    expect(screen.queryByText("Disconnected")).toBeNull();
  });

  it.each(["unavailable", "offline"] as const)(
    "shows effective %s as offline on the quick profile control",
    (state) => {
      effectivePresence = state;
      render(
        <UserPresenceQuickControl accountId="account-a" userId="@alice:a" />,
      );

      const quickControl = screen.getByRole("button", {
        name: "Availability",
      });
      expect(
        quickControl.querySelector(".hub__user-presence--offline"),
      ).not.toBeNull();
    },
  );

  it("uses the same preference mutation from the quick profile control", () => {
    render(
      <UserPresenceQuickControl accountId="account-a" userId="@alice:a" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Offline" }));
    fireEvent.click(screen.getByRole("button", { name: "Online" }));

    expect(setSelfPresencePreference.mock.calls).toEqual([
      ["offline"],
      ["online"],
    ]);
  });
});
