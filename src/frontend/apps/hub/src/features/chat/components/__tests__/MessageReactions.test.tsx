// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";
import type { ChatReaction } from "@/features/drivers/types";

import { MessageReactions } from "../MessageReactions";

const reaction = (over: Partial<ChatReaction> = {}): ChatReaction => ({
  emoji: "👍",
  count: 1,
  reactedByMe: false,
  ...over,
});

describe("MessageReactions", () => {
  it("renders nothing when there are no reactions", () => {
    const { container } = render(
      <MessageReactions reactions={[]} onReact={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders one chip per reaction with its count, plus the add button", () => {
    render(
      <MessageReactions
        reactions={[
          reaction({ emoji: "👍", count: 3 }),
          reaction({ emoji: "🎉", count: 1 }),
        ]}
        onReact={vi.fn()}
      />,
    );

    // Two reaction chips and the trailing add-reaction button.
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("marks the current user's reaction as pressed and brand-tinted", () => {
    render(
      <MessageReactions
        reactions={[
          reaction({ emoji: "👍", count: 2, reactedByMe: true }),
          reaction({ emoji: "🎉", count: 1, reactedByMe: false }),
        ]}
        onReact={vi.fn()}
      />,
    );

    const mine = screen.getByRole("button", { pressed: true });
    expect(mine.className).toContain("hub__message-reactions__chip--mine");
    expect(screen.getByRole("button", { pressed: false })).toBeTruthy();
  });

  it("gives chips a reacted-state-aware accessible name", () => {
    render(
      <MessageReactions
        reactions={[
          reaction({ emoji: "👍", count: 2, reactedByMe: true }),
          reaction({ emoji: "🎉", count: 1, reactedByMe: false }),
        ]}
        onReact={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /remove your/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /react with/i })).toBeTruthy();
  });

  it("calls onReact with the emoji when a chip is activated", () => {
    const onReact = vi.fn();
    render(
      <MessageReactions
        reactions={[reaction({ emoji: "🎉", count: 1 })]}
        onReact={onReact}
      />,
    );

    fireEvent.click(screen.getByRole("button", { pressed: false }));
    expect(onReact).toHaveBeenCalledWith("🎉");
  });
});
