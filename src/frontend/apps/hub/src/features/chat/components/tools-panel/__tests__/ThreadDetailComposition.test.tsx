// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";
import type { ChatRef, ChatThreadDetail } from "@/features/drivers/types";

import { ThreadDetail } from "../ThreadDetail";

const sendReply = vi.fn().mockResolvedValue(undefined);
const markThreadRead = vi.fn();

const detail: ChatThreadDetail = {
  id: "thread-1",
  rootMessageId: "m-root",
  messages: [
    {
      id: "m-root",
      authorId: "alice",
      content: "Root message",
      timestamp: "2026-05-12T10:00:00.000Z",
      reactions: [],
    },
    {
      id: "reply-1",
      authorId: "alice",
      content: "Already loaded reply",
      timestamp: "2026-05-12T10:01:00.000Z",
      reactions: [],
    },
  ],
  authors: [{ id: "alice", name: "Alice", initials: "A", color: "blue-1" }],
  firstUnreadIndex: null,
};

vi.mock("../../../hooks/useChatThread", () => ({
  useChatThread: () => ({
    thread: detail,
    isInitialLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../../hooks/useChatThreadActions", () => ({
  useChatThreadActions: () => ({
    markThreadRead,
    markAllRead: vi.fn(),
  }),
}));

vi.mock("../../../hooks/useSendChatThreadReply", () => ({
  useSendChatThreadReply: () => ({
    sendReply,
    isSending: false,
    isSupported: true,
  }),
}));

vi.mock("../../../hooks/useToggleReaction", () => ({
  useToggleReaction: () => ({ toggle: vi.fn() }),
}));

vi.mock("../../../hooks/useChatCompositionSupport", () => ({
  useChatCompositionSupport: () => true,
}));

vi.mock("../../../hooks/useEditChatMessage", () => ({
  useEditChatMessage: () => ({ editMessage: vi.fn(), isEditing: false }),
}));

vi.mock("../../../hooks/useDeleteChatMessage", () => ({
  useDeleteChatMessage: () => ({ deleteMessage: vi.fn(), isDeleting: false }),
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };

describe("ThreadDetail composition", () => {
  beforeEach(() => {
    sendReply.mockClear();
    markThreadRead.mockClear();
  });

  it("submits the answer composer through the thread reply hook", async () => {
    render(
      <ThreadDetail
        chatRef={CHAT_REF}
        threadId="thread-1"
        isOpen
        onClose={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Answer"), {
      target: { value: "  I agree  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(sendReply).toHaveBeenCalledWith("I agree");
    });
    expect(markThreadRead).toHaveBeenCalledWith("thread-1");
  });
});
