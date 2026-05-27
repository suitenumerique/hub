// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";

import { MessageHoverToolbar } from "../MessageHoverToolbar";

describe("MessageHoverToolbar", () => {
  it("offers Reply and More actions by default", () => {
    render(<MessageHoverToolbar onReact={vi.fn()} />);

    expect(screen.getByText("Reply")).toBeTruthy();
    expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy();
  });

  it("drops Reply and More in compact mode but keeps the reactions", () => {
    render(<MessageHoverToolbar onReact={vi.fn()} compact />);

    expect(screen.queryByText("Reply")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "More actions" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add a reaction" }),
    ).toBeTruthy();
  });

  it("forwards a quick reaction to onReact in compact mode", () => {
    const onReact = vi.fn();
    render(<MessageHoverToolbar onReact={onReact} compact />);

    fireEvent.click(
      screen.getByRole("button", { name: "React with a thumbs up" }),
    );
    expect(onReact).toHaveBeenCalledWith("👍");
  });
});
