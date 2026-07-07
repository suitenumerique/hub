// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";
import type { Chat, ChatRef } from "@/features/drivers/types";

import { ChatView } from "../ChatView";

const CHAT_REF: ChatRef = { accountId: "matrix-local", chatId: "!room:localhost" };
const INVITE_CHAT: Chat = {
  id: CHAT_REF.chatId,
  accountId: CHAT_REF.accountId,
  ref: CHAT_REF,
  name: "Project invite",
  section: "all",
  kind: "group",
  participantIds: ["@bob:localhost"],
  visual: { kind: "icon", icon: "mail" },
  membership: "invite",
  invitation: { inviterId: "@bob:localhost", inviterName: "Bob Dubois" },
};

vi.mock("@gouvfr-lasuite/ui-kit", () => ({
  FilePreview: () => null,
}));

vi.mock("../../hooks/useChat", () => ({
  useChat: () => ({
    chat: INVITE_CHAT,
    isInitialLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../hooks/useChatThreads", () => ({
  useChatThreads: () => ({
    threads: [],
    unreadThreads: [],
    isInitialLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../hooks/useSendChatMessage", () => ({
  useSendChatMessage: () => ({
    sendMessage: vi.fn(),
    isSending: false,
    isSupported: true,
  }),
}));

vi.mock("../ChatConversation", () => ({
  ChatConversation: () => <div data-testid="conversation" />,
}));

vi.mock("../header/ChatHeader", () => ({
  ChatHeader: ({ chat }: { chat: Chat | null }) => (
    <div data-testid="chat-header">{chat?.name}</div>
  ),
}));

// Isolate the branch wiring from the invitation container's router/registry deps.
vi.mock("../ChatInvitationView", () => ({
  ChatInvitationView: () => <div data-testid="invitation" />,
}));

vi.mock("../tools-panel/ChatToolsPanel", () => ({
  ChatToolsPanel: () => <div data-testid="tools-panel" />,
}));

describe("ChatView invitation branch", () => {
  it("renders the invitation detail instead of the conversation timeline", () => {
    render(<ChatView chatRef={CHAT_REF} />);

    expect(screen.getByTestId("invitation")).toBeTruthy();
    expect(screen.queryByTestId("conversation")).toBeNull();
  });

  it("suppresses the composer and the tools panel for a pending invitation", () => {
    render(<ChatView chatRef={CHAT_REF} />);

    expect(screen.queryByLabelText("Message")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
    expect(screen.queryByTestId("tools-panel")).toBeNull();
  });
});
