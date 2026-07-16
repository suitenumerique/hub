// @vitest-environment jsdom
import "@/i18n/initI18n";

import { CunninghamProvider } from "@gouvfr-lasuite/ui-kit";
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Chat } from "@/features/drivers/types";

import { ChatMembersModal } from "../header/ChatMembersModal";

vi.mock("@/features/chat/hooks/useChatMembers", () => ({
  useChatMembers: () => ({
    present: [
      { id: "@me:example.test", name: "You", secondaryText: "La Suite" },
      {
        id: "@alice:example.test",
        name: "Alice",
        secondaryText: "Modernisation",
      },
      {
        id: "@hub-bot:example.test",
        name: "Hub bot",
        secondaryText: "@hub-bot:example.test",
      },
    ],
    pendingInvites: [
      {
        id: "@bob:example.test",
        name: "Bob",
        secondaryText: "bob@example.test",
      },
    ],
    isInitialLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

const CHAT: Chat = {
  id: "chat-1",
  accountId: "account-a",
  ref: { accountId: "account-a", chatId: "chat-1" },
  name: "Project",
  section: "all",
  kind: "hub_group",
  participantIds: ["alice", "bob"],
  visual: { kind: "icon", icon: "groups" },
  hubGroup: {
    id: "group-1",
    status: "active",
    name: "Project",
    ministry: "",
    tags: [],
    visibility: "private",
    emoji: "🌲",
    allow_external_guests: false,
    member_count: 2,
    matrix: {
      room_id: "chat-1",
      account_id: "account-a",
      via: ["example.test"],
    },
    members: [
      {
        mxid: "@me:example.test",
        hub_user_id: null,
        display_name: "You",
        role: "owner",
      },
      {
        mxid: "@alice:example.test",
        hub_user_id: null,
        display_name: "Alice",
        role: "moderator",
      },
      {
        mxid: "@hub-bot:example.test",
        hub_user_id: null,
        display_name: "Hub bot",
        role: "bot",
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

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => vi.unstubAllGlobals());

describe("ChatMembersModal", () => {
  it("renders members and invitations without mutation controls", () => {
    render(
      <CunninghamProvider currentLocale="en-US" theme="dsfr-light">
        <ChatMembersModal chat={CHAT} isOpen onClose={vi.fn()} />
      </CunninghamProvider>,
    );

    expect(screen.getByText("Group members")).toBeTruthy();
    expect(screen.getByText("Shared between 2 people")).toBeTruthy();
    expect(screen.getByText("Pending invitations")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText(/bob@example\.test/)).toBeTruthy();
    expect(screen.queryByText("Hub bot")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /remove|delete/i })).toBeNull();
    expect(screen.queryByText("Turn into group")).toBeNull();
  });
});
