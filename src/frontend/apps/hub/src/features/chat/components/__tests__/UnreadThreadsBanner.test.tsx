// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";
import {
  ChatPanelProvider,
  type ChatPanelContextValue,
} from "../../ChatPanelContext";
import type { ChatThread } from "@/features/drivers/types";

import { UnreadThreadsBanner } from "../UnreadThreadsBanner";

const markAllChatThreadsRead = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/config/Config", () => ({
  getDriver: () => ({ markAllChatThreadsRead }),
}));

const buildThread = (id: string): ChatThread => ({
  id,
  rootMessageId: `m-${id}`,
  author: { id: "a-1", name: "Ada Lovelace", initials: "AL", color: "blue-1" },
  lastReplyAt: "2026-05-12T10:00:00.000Z",
  lastReplyPreview: "Latest reply",
  replyCount: 5,
  unreadCount: 2,
});

const renderBanner = (
  unreadThreads: ChatThread[],
  panel: Partial<ChatPanelContextValue> = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const value: ChatPanelContextValue = {
    openThread: vi.fn(),
    openThreadList: vi.fn(),
    ...panel,
  };
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ChatPanelProvider value={value}>{children}</ChatPanelProvider>
    </QueryClientProvider>
  );
  render(
    <UnreadThreadsBanner chatId="chat-1" unreadThreads={unreadThreads} />,
    { wrapper: Wrapper },
  );
  return value;
};

describe("UnreadThreadsBanner", () => {
  beforeEach(() => {
    markAllChatThreadsRead.mockClear();
  });

  it("jumps straight to the thread when only one is unread", () => {
    const panel = renderBanner([buildThread("t-1")]);

    expect(screen.getByText("1 unread thread")).toBeTruthy();

    fireEvent.click(screen.getByText("1 unread thread"));
    expect(panel.openThread).toHaveBeenCalledWith("t-1");
    expect(panel.openThreadList).not.toHaveBeenCalled();
  });

  it("opens the thread list when several threads are unread", () => {
    const panel = renderBanner([
      buildThread("t-1"),
      buildThread("t-2"),
      buildThread("t-3"),
    ]);

    expect(screen.getByText("3 unread threads")).toBeTruthy();

    fireEvent.click(screen.getByText("3 unread threads"));
    expect(panel.openThreadList).toHaveBeenCalledTimes(1);
    expect(panel.openThread).not.toHaveBeenCalled();
  });

  it("marks every thread read through the driver", async () => {
    renderBanner([buildThread("t-1"), buildThread("t-2")]);

    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => {
      expect(markAllChatThreadsRead).toHaveBeenCalledWith("chat-1");
    });
  });
});
