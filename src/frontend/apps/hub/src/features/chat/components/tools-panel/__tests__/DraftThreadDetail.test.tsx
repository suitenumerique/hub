// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";
import type {
  ChatMessage,
  ChatRef,
  ChatThreadMutationResult,
} from "@/features/drivers/types";

import { DraftThreadDetail } from "../DraftThreadDetail";

const startThread = vi.fn();

vi.mock("../../../hooks/useStartChatThread", () => ({
  useStartChatThread: () => ({
    startThread,
    isStarting: false,
    isSupported: true,
  }),
}));

vi.mock("../../../hooks/useToggleReaction", () => ({
  useToggleReaction: () => ({ toggle: vi.fn() }),
}));

vi.mock("../../../hooks/useChatCompositionSupport", () => ({
  useChatCompositionSupport: () => true,
}));

vi.mock("../../../hooks/useDeleteChatMessage", () => ({
  useDeleteChatMessage: () => ({ deleteMessage: vi.fn(), isDeleting: false }),
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };
const ROOT_MESSAGE: ChatMessage = {
  id: "m-root",
  authorId: "me",
  content: "Root from me",
  timestamp: "2026-05-12T10:00:00.000Z",
  reactions: [],
};

const result = (root: ChatMessage): ChatThreadMutationResult => ({
  message: {
    id: "thread-real-r1",
    authorId: "me",
    content: "First reply",
    timestamp: "2026-05-12T10:01:00.000Z",
    reactions: [],
  },
  thread: {
    id: "thread-real",
    rootMessageId: root.id,
    author: { id: "me", name: "You", initials: "ME", color: "blue-1" },
    lastReplyAt: "2026-05-12T10:01:00.000Z",
    lastReplyPreview: "First reply",
    replyCount: 1,
    unreadCount: 0,
  },
  threadDetail: {
    id: "thread-real",
    rootMessageId: root.id,
    messages: [root],
    authors: [],
    firstUnreadIndex: null,
  },
  rootMessage: {
    ...root,
    thread: { id: "thread-real", replyCount: 1, unreadCount: 0 },
  },
});

describe("DraftThreadDetail", () => {
  beforeEach(() => {
    startThread.mockReset();
    startThread.mockImplementation(
      (
        _root: ChatMessage,
        _content: string,
        callbacks?: {
          rootAuthor?: unknown;
          onOptimisticThread?: (threadId: string) => void;
          onCreated?: (threadId: string) => void;
        },
      ) => {
        callbacks?.onOptimisticThread?.("thread-optimistic");
        callbacks?.onCreated?.("thread-real");
        return Promise.resolve(result(ROOT_MESSAGE));
      },
    );
  });

  it("focuses the draft composer and opens only the confirmed thread", async () => {
    const onCreated = vi.fn();
    render(
      <DraftThreadDetail
        chatRef={CHAT_REF}
        root={{ message: ROOT_MESSAGE }}
        isOpen
        onClose={vi.fn()}
        onBack={vi.fn()}
        onCreated={onCreated}
      />,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("Answer"));
    });

    fireEvent.change(screen.getByLabelText("Answer"), {
      target: { value: "  First reply  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(startThread).toHaveBeenCalledWith(
        ROOT_MESSAGE,
        "First reply",
        expect.any(Object),
      );
      expect(onCreated).toHaveBeenCalledWith("thread-real", {
        focusComposer: true,
      });
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
  });
});
