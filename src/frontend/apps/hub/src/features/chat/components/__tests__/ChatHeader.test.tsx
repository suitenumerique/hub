// @vitest-environment jsdom
import "@/i18n/initI18n";

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Chat } from "@/features/drivers/types";

import { ChatHeader } from "../header/ChatHeader";

const { renameChat, setFavourite } = vi.hoisted(() => ({
  renameChat: vi.fn(async () => undefined),
  setFavourite: vi.fn(),
}));

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
vi.mock("@/features/chat/hooks/useCreateHubGroup", () => ({
  useCreateHubGroup: () => ({
    createGroup: vi.fn(),
    isCreating: false,
    reset: vi.fn(),
  }),
}));
vi.mock("@/features/chat/hooks/useHubGroupCreationSupport", () => ({
  useHubGroupCreationSupport: () => true,
}));
vi.mock("@/features/chat/hooks/useRenameChat", () => ({
  useRenameChat: () => ({
    canRename: true,
    isChecking: false,
    renameChat,
    isRenaming: false,
  }),
}));
vi.mock("next/router", () => ({
  useRouter: () => ({ replace: vi.fn() }),
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
vi.mock("../GroupCreateModal", () => ({
  GroupCreateModal: () => null,
}));
vi.mock("../header/RenameGroupModal", () => ({
  RenameGroupModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">Rename group modal</div> : null,
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

const GROUP_CHAT: Chat = {
  ...CHAT,
  name: "Project group",
  kind: "hub_group",
  participantIds: ["alice", "bob"],
  visual: { kind: "emoji", emoji: "🌲" },
  hubGroup: {
    id: "group-1",
    status: "active",
    name: "Project group",
    ministry: "",
    tags: [],
    visibility: "private",
    emoji: "🌲",
    allow_external_guests: false,
    member_count: 1,
    matrix: {
      room_id: "chat-1",
      account_id: "account-a",
      via: ["example.test"],
    },
    members: [
      {
        mxid: "alice",
        hub_user_id: null,
        display_name: "Alice",
        role: "member",
      },
    ],
    rooms: [
      {
        room_id: "chat-1",
        role: "active",
        sequence: 0,
      },
    ],
  },
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

  it("offers rename but never create-group for an official Hub group", async () => {
    render(
      <ChatHeader chat={GROUP_CHAT} activeTool={null} onToggleTool={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Project group" }));

    expect(
      screen.queryByRole("menuitem", { name: "Create a group" }),
    ).toBeNull();
    expect(
      await screen.findByRole("menuitem", { name: "Rename group" }),
    ).toHaveProperty("disabled", false);
  });
});
