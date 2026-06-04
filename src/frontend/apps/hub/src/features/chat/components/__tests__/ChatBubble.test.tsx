// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";
import {
  ChatPanelProvider,
  type ChatPanelContextValue,
} from "../../ChatPanelContext";
import type { ChatMessageAuthor, ChatRef } from "@/features/drivers/types";

import { ChatBubble } from "../ChatBubble";

const useChatCompositionSupport = vi.fn(() => true);

vi.mock("../../hooks/useChatCompositionSupport", () => ({
  useChatCompositionSupport: (ref: ChatRef) => useChatCompositionSupport(ref),
}));

vi.mock("../../hooks/useToggleReaction", () => ({
  useToggleReaction: () => ({ toggle: vi.fn() }),
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };
const AUTHOR: ChatMessageAuthor = {
  id: "alice",
  name: "Alice",
  initials: "A",
  color: "blue-1",
};

const renderBubble = (
  element: ReactNode,
  panel: Partial<ChatPanelContextValue> = {},
) => {
  const value: ChatPanelContextValue = {
    openThread: vi.fn(),
    openDraftThread: vi.fn(),
    openThreadList: vi.fn(),
    ...panel,
  };
  render(<ChatPanelProvider value={value}>{element}</ChatPanelProvider>);
  return value;
};

describe("ChatBubble reply action", () => {
  beforeEach(() => {
    useChatCompositionSupport.mockReturnValue(true);
  });

  it("opens a draft thread when the message has no thread", () => {
    const panel = renderBubble(
      <ChatBubble
        variant="received"
        chatRef={CHAT_REF}
        messageId="m-1"
        content="Root message"
        author={AUTHOR}
        timestamp="2026-05-12T10:00:00.000Z"
        reactions={[]}
        showHeader
        showAvatar
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect(panel.openDraftThread).toHaveBeenCalledWith({
      message: expect.objectContaining({
        id: "m-1",
        authorId: "alice",
        content: "Root message",
      }),
      author: AUTHOR,
    });
    expect(panel.openThread).not.toHaveBeenCalled();
  });

  it("opens an existing thread instead of a draft", () => {
    const panel = renderBubble(
      <ChatBubble
        variant="received"
        chatRef={CHAT_REF}
        messageId="m-1"
        content="Root message"
        author={AUTHOR}
        timestamp="2026-05-12T10:00:00.000Z"
        reactions={[]}
        thread={{ id: "thread-1", replyCount: 2, unreadCount: 0 }}
        showHeader
        showAvatar
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect(panel.openThread).toHaveBeenCalledWith("thread-1");
    expect(panel.openDraftThread).not.toHaveBeenCalled();
  });

  it("disables starting a new thread when composition is unsupported", () => {
    useChatCompositionSupport.mockReturnValue(false);
    renderBubble(
      <ChatBubble
        variant="received"
        chatRef={CHAT_REF}
        messageId="m-1"
        content="Root message"
        author={AUTHOR}
        timestamp="2026-05-12T10:00:00.000Z"
        reactions={[]}
        showHeader
        showAvatar
      />,
    );

    expect(
      screen.getByRole("button", { name: "Reply" }).getAttribute("disabled"),
    ).not.toBeNull();
  });
});
