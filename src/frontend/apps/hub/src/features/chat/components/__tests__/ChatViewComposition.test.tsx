// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";
import type { Chat, ChatRef } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { ChatView } from "../ChatView";

vi.mock("@/features/ui/components/toast", () => ({
  notify: { error: vi.fn() },
}));

const sendMessage = vi.fn().mockResolvedValue(undefined);
const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };
const CHAT: Chat = {
  id: CHAT_REF.chatId,
  accountId: CHAT_REF.accountId,
  ref: CHAT_REF,
  name: "Existing chat",
  section: "all",
  kind: "group",
  participantIds: ["alice"],
  visual: { kind: "initials" },
};

vi.mock("@gouvfr-lasuite/ui-kit", () => ({
  FilePreview: () => null,
}));

vi.mock("../../hooks/useChat", () => ({
  useChat: () => ({
    chat: CHAT,
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
    sendMessage,
    isSending: false,
    isSupported: true,
  }),
}));

vi.mock("../../hooks/useEditChatMessage", () => ({
  useEditChatMessage: () => ({ editMessage: vi.fn(), isEditing: false }),
}));

vi.mock("../../hooks/useChatTyping", () => ({
  useChatTyping: () => ({
    users: [],
    onTypingActivity: vi.fn().mockResolvedValue(undefined),
    stopTyping: vi.fn().mockResolvedValue(undefined),
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

vi.mock("../tools-panel/ChatToolsPanel", () => ({
  ChatToolsPanel: () => null,
}));

describe("ChatView composition", () => {
  beforeEach(() => {
    sendMessage.mockClear();
    sendMessage.mockResolvedValue(undefined);
    vi.mocked(notify.error).mockClear();
  });

  it("submits the existing conversation composer through useSendChatMessage", async () => {
    render(<ChatView chatRef={CHAT_REF} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "  Hello existing chat  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("Hello existing chat");
    });
  });

  it("notifies onSent with the chat ref after a successful send", async () => {
    const onSent = vi.fn();
    render(<ChatView chatRef={CHAT_REF} onSent={onSent} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Open the conversation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(onSent).toHaveBeenCalledWith(CHAT_REF);
    });
  });

  it("does not notify onSent when the send fails", async () => {
    sendMessage.mockRejectedValueOnce(new Error("network"));
    const onSent = vi.fn();
    render(<ChatView chatRef={CHAT_REF} onSent={onSent} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Should not navigate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    // The composer surfaces the failure via a toast; once that has run, the
    // send flow is settled and onSent must not have fired (no redirect).
    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledTimes(1);
    });
    expect(onSent).not.toHaveBeenCalled();
  });
});
