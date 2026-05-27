// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FluentEmoji } from "../FluentEmoji";

describe("FluentEmoji", () => {
  it("renders the Fluent asset for the emoji", () => {
    render(<FluentEmoji emoji="👍" label="thumbs up" />);

    const img = screen.getByRole("img", { name: "thumbs up" });
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toContain("1f44d_3d.png");
  });

  it("falls back to the native glyph when the asset fails to load", () => {
    render(<FluentEmoji emoji="👍" label="thumbs up" />);

    fireEvent.error(screen.getByRole("img", { name: "thumbs up" }));

    const fallback = screen.getByRole("img", { name: "thumbs up" });
    expect(fallback.tagName).toBe("SPAN");
    expect(fallback.textContent).toBe("👍");
  });
});
