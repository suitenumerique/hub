// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";

import { ThreadButton } from "../ThreadButton";

describe("ThreadButton", () => {
  it("shows the reply count and stays neutral when fully read", () => {
    render(
      <ThreadButton
        summary={{ id: "t-1", replyCount: 7, unreadCount: 0 }}
        onOpen={vi.fn()}
      />,
    );

    const button = screen.getByRole("button");
    expect(button.textContent).toContain("7 replies");
    expect(button.textContent).not.toContain("unread");
    expect(button.className).not.toContain("hub__chat-thread-button--unread");
  });

  it("appends the unread count and the unread modifier when unread", () => {
    render(
      <ThreadButton
        summary={{ id: "t-1", replyCount: 11, unreadCount: 3 }}
        onOpen={vi.fn()}
      />,
    );

    const button = screen.getByRole("button");
    expect(button.textContent).toContain("11 replies");
    expect(button.textContent).toContain("3 unread");
    expect(button.className).toContain("hub__chat-thread-button--unread");
  });

  it("calls onOpen when clicked", () => {
    const onOpen = vi.fn();
    render(
      <ThreadButton
        summary={{ id: "t-1", replyCount: 2, unreadCount: 0 }}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
