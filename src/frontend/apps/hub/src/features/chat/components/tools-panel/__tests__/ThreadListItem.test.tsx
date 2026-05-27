// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";
import type { ChatThread } from "@/features/drivers/types";

import { ThreadListItem } from "../ThreadListItem";

const buildThread = (over: Partial<ChatThread> = {}): ChatThread => ({
  id: "t-1",
  rootMessageId: "m-1",
  author: { id: "a-1", name: "Ada Lovelace", initials: "AL", color: "blue-1" },
  lastReplyAt: "2026-05-12T10:09:00.000Z",
  lastReplyPreview: "What about security and GDPR?",
  replyCount: 7,
  unreadCount: 0,
  ...over,
});

const renderItem = (thread: ChatThread, onOpen = vi.fn()) =>
  render(
    <ul>
      <ThreadListItem thread={thread} onOpen={onOpen} />
    </ul>,
  );

describe("ThreadListItem", () => {
  it("renders the author, preview and read reply count", () => {
    renderItem(buildThread());

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("What about security and GDPR?")).toBeTruthy();

    const button = screen.getByRole("button");
    expect(button.textContent).toContain("7 replies");
    expect(button.textContent).not.toContain("unread");
  });

  it("flags the unread state and shows the unread reply count", () => {
    renderItem(buildThread({ unreadCount: 3 }));

    const item = document.querySelector(".hub__chat-thread-item");
    expect(item?.getAttribute("data-unread")).toBe("true");
    expect(screen.getByRole("button").textContent).toContain("3 unread");
  });

  it("calls onOpen when the row is activated", () => {
    const onOpen = vi.fn();
    renderItem(buildThread(), onOpen);

    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
