// @vitest-environment jsdom
import "@/i18n/initI18n";

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Chat } from "@/features/drivers/types";

import { ChatHeader } from "../header/ChatHeader";

const { setFavourite } = vi.hoisted(() => ({ setFavourite: vi.fn() }));

vi.mock("@gouvfr-lasuite/ui-kit", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@gouvfr-lasuite/ui-kit")>();
  return {
    ...actual,
    DropdownMenu: ({
      children,
      isOpen,
      onOpenChange,
      options,
    }: {
      children: ReactNode;
      isOpen?: boolean;
      onOpenChange?: (isOpen: boolean) => void;
      options: Array<{
        type?: string;
        label?: string;
        callback?: () => void;
        isDisabled?: boolean;
      }>;
    }) => (
      <>
        {children}
        {isOpen ? (
          <div role="menu">
            {options.map((option, index) =>
              option.type === "separator" ? (
                <hr key={index} />
              ) : (
                <button
                  key={option.label}
                  type="button"
                  role="menuitem"
                  aria-disabled={option.isDisabled || undefined}
                  disabled={option.isDisabled}
                  onClick={() => {
                    option.callback?.();
                    onOpenChange?.(false);
                  }}
                >
                  {option.label}
                </button>
              ),
            )}
          </div>
        ) : null}
      </>
    ),
  };
});
vi.mock("@/features/chat/hooks/useChatFavourite", () => ({
  useChatFavourite: () => ({ setFavourite, isPending: false }),
}));
vi.mock(
  "@/features/layouts/components/AccountSelector/AccountSelector",
  () => ({
    AccountSelector: () => <div data-testid="account-selector" />,
  }),
);
vi.mock("../header/ChatMembersModal", () => ({
  ChatMembersModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">Members modal</div> : null,
}));

const CHAT: Chat = {
  id: "chat-1",
  accountId: "account-a",
  ref: { accountId: "account-a", chatId: "chat-1" },
  name: "Alice",
  section: "all",
  kind: "direct",
  participantIds: ["alice"],
  visual: { kind: "initials" },
};

describe("ChatHeader menu", () => {
  const renderHeader = () =>
    render(<ChatHeader chat={CHAT} activeTool={null} onToggleTool={vi.fn()} />);

  it("opens the UI-kit menu and keeps future actions disabled", async () => {
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "Alice" }));

    expect(
      await screen.findByRole("menuitem", { name: "Members" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("menuitem", { name: "Rename conversation" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      screen
        .getByRole("menuitem", { name: "Notifications" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      screen
        .getByRole("menuitem", { name: "Leave conversation" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("opens members and can add the conversation to favourites", async () => {
    setFavourite.mockReset();
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "Alice" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Members" }));
    expect(screen.getByRole("dialog").textContent).toContain("Members modal");

    fireEvent.click(screen.getByRole("button", { name: "Alice" }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Add to favourites" }),
    );
    expect(setFavourite).toHaveBeenCalledWith(true);
  });
});
