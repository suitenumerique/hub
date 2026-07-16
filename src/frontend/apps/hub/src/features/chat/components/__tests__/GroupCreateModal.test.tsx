// @vitest-environment jsdom
import "@/i18n/initI18n";

import { CunninghamProvider } from "@gouvfr-lasuite/ui-kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GroupCreateModal } from "../GroupCreateModal";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => vi.unstubAllGlobals());

describe("GroupCreateModal", () => {
  it("submits only the minimal group settings", () => {
    const onSubmit = vi.fn();
    render(
      <CunninghamProvider currentLocale="en-US" theme="dsfr-light">
        <GroupCreateModal
          isOpen
          isSubmitting={false}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />
      </CunninghamProvider>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: /Group name/ }), {
      target: { value: "  Team forest  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Team forest",
      emoji: "🌲",
      allowExternalGuests: false,
    });
    expect(screen.queryByText(/announcement|only admins can post/i)).toBeNull();
  });
});
