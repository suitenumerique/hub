// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UserPresenceIndicator } from "../UserPresenceIndicator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("UserPresenceIndicator", () => {
  it.each([
    ["online", "Online"],
    ["unavailable", "Offline"],
    ["offline", "Offline"],
  ] as const)("renders an accessible %s indicator", (state, label) => {
    render(<UserPresenceIndicator state={state} />);

    const indicator = screen.getByRole("img", { name: label });
    expect(indicator.getAttribute("data-presence")).toBe(state);
    expect(indicator.getAttribute("title")).toBe(label);
    expect(indicator.classList.contains("hub__user-presence--offline")).toBe(
      state !== "online",
    );
    expect(indicator.classList.contains("hub__user-presence--online")).toBe(
      state === "online",
    );
  });

  it("supports the shared avatar overlay placement", () => {
    render(<UserPresenceIndicator state="online" placement="avatar" />);

    expect(
      screen
        .getByRole("img", { name: "Online" })
        .classList.contains("hub__user-presence--avatar"),
    ).toBe(true);
  });

  it("renders nothing for an unknown presence", () => {
    const { container } = render(<UserPresenceIndicator state={null} />);

    expect(container.childElementCount).toBe(0);
  });
});
