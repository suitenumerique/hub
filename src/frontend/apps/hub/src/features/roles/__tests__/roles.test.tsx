// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAPI } from "@/features/api/fetchApi";
import { RoleBadge, UserRoleBadge } from "../RoleBadge";
import { RoleProfileAction } from "../RoleProfileAction";
import { RoleEditor, RoleProfileProvider } from "../RoleProfileProvider";

const { identityToken } = vi.hoisted(() => ({ identityToken: vi.fn() }));
vi.mock("@/features/api/fetchApi", () => ({ fetchAPI: vi.fn() }));
vi.mock("@/features/auth/Auth", () => ({
  useAuth: () => ({
    user: { id: "viewer" },
    chatUser: { userId: "@viewer:localhost" },
  }),
}));
vi.mock("@/features/drivers/DriverRegistry", () => ({
  useDriverEntries: () => [
    {
      driver: {
        supportsProfileRoles: true,
        getProfileIdentityToken: identityToken,
      },
    },
  ],
}));
vi.mock("@/features/ui/components/toast", () => ({
  notify: { brand: vi.fn() },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@gouvfr-lasuite/ui-components", () => ({
  ModalSize: { SMALL: "small" },
  Modal: ({
    children,
    title,
    rightActions,
  }: {
    children: ReactNode;
    title: string;
    rightActions: ReactNode;
  }) => (
    <div role="dialog" aria-label={title}>
      {children}
      {rightActions}
    </div>
  ),
  Button: ({
    children,
    variant,
    color,
    size,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }) => {
    void variant;
    void color;
    void size;
    return <button {...props}>{children}</button>;
  },
  UserMenuItem: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
}));

const defaults = {
  initialRole: "",
  loading: false,
  loadError: false,
  saving: false,
  saveError: false,
  onClose: vi.fn(),
  onSave: vi.fn(),
  onRetry: vi.fn(),
};
const withQueries = (children: ReactNode) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })
    }
  >
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  identityToken.mockResolvedValue("current-proof");
});
afterEach(cleanup);

describe("Role editor", () => {
  it("keeps a preset as a draft until Save is pressed", () => {
    render(<RoleEditor {...defaults} />);
    fireEvent.click(screen.getByRole("button", { name: "DEV" }));
    expect(defaults.onSave).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText("Role or custom title") as HTMLInputElement).value,
    ).toBe("DEV");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(defaults.onSave).toHaveBeenCalledWith("DEV");
  });

  it("saves custom labels and can remove a saved role", () => {
    render(<RoleEditor {...defaults} initialRole="PM" />);
    fireEvent.change(screen.getByLabelText("Role or custom title"), {
      target: { value: "  Support  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(defaults.onSave).toHaveBeenCalledWith("Support");
    fireEvent.click(screen.getByRole("button", { name: "Remove my role" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(defaults.onSave).toHaveBeenLastCalledWith("");
  });

  it("does not save when cancelled and keeps a failed draft editable", () => {
    render(<RoleEditor {...defaults} initialRole="PO" saveError />);
    expect(screen.getByRole("alert").textContent).toContain(
      "could not be saved",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(defaults.onClose).toHaveBeenCalledOnce();
    expect(defaults.onSave).not.toHaveBeenCalled();
  });

  it("cannot overwrite a profile while it is loading or unavailable", () => {
    const view = render(<RoleEditor {...defaults} loading />);
    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    view.rerender(<RoleEditor {...defaults} loadError />);
    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(defaults.onRetry).toHaveBeenCalledOnce();
  });

  it("announces the length limit and the failure with the field itself", () => {
    const view = render(<RoleEditor {...defaults} initialRole="PO" />);
    const input = screen.getByLabelText("Role or custom title");
    const described = (id: string) =>
      (input.getAttribute("aria-describedby") ?? "").split(" ").includes(id);
    const hint = screen.getByText(
      "40 characters maximum. Leave blank to show no role.",
    );

    expect(described(hint.id)).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBeNull();

    view.rerender(<RoleEditor {...defaults} initialRole="PO" saveError />);
    const alert = screen.getByRole("alert");

    expect(described(alert.id)).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("moves focus to the failure instead of dropping it on the document", () => {
    const view = render(<RoleEditor {...defaults} initialRole="PO" />);
    view.rerender(<RoleEditor {...defaults} initialRole="PO" saveError />);

    expect(document.activeElement).toBe(screen.getByRole("alert"));
  });

  it("never takes a control away from the focus that just used it", () => {
    const view = render(<RoleEditor {...defaults} initialRole="PO" saving />);
    const save = screen.getByRole("button", { name: "Saving…" });

    // Still focusable, so the keyboard does not fall back to the document.
    expect((save as HTMLButtonElement).disabled).toBe(false);
    expect(save.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(save);
    expect(defaults.onSave).not.toHaveBeenCalled();

    // And the removal control stays put once the field is empty.
    view.rerender(<RoleEditor {...defaults} initialRole="" />);
    expect(
      screen.getByRole("button", { name: "Remove my role" }),
    ).not.toBeNull();
  });

  it("uses an asynchronously loaded role without overwriting an edited draft", () => {
    const view = render(<RoleEditor {...defaults} loading />);
    view.rerender(<RoleEditor {...defaults} initialRole="PO" />);
    expect(
      (screen.getByLabelText("Role or custom title") as HTMLInputElement).value,
    ).toBe("PO");
    fireEvent.change(screen.getByLabelText("Role or custom title"), {
      target: { value: "DEV" },
    });
    view.rerender(<RoleEditor {...defaults} initialRole="PM" />);
    expect(
      (screen.getByLabelText("Role or custom title") as HTMLInputElement).value,
    ).toBe("DEV");
  });
});

describe("Profile integration", () => {
  it("does nothing on first connection and opens only from the profile menu", async () => {
    vi.mocked(fetchAPI).mockResolvedValue(
      new Response(
        JSON.stringify({ role: "PO", matrix_id: "@alice:localhost" }),
      ),
    );
    render(
      withQueries(
        <RoleProfileProvider>
          <RoleProfileAction />
        </RoleProfileProvider>,
      ),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchAPI).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "My role" }));
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Role or custom title") as HTMLInputElement)
          .value,
      ).toBe("PO"),
    );
    expect(fetchAPI).toHaveBeenCalledOnce();
  });

  it("saves using the current chat proof and reopens the persisted value", async () => {
    vi.mocked(fetchAPI).mockImplementation(async (_url, init) => {
      if (init?.method === "PATCH")
        return new Response(
          JSON.stringify({ role: "DEV", matrix_id: "@alice:localhost" }),
        );
      return new Response(JSON.stringify({ role: "", matrix_id: null }));
    });
    render(
      withQueries(
        <RoleProfileProvider>
          <RoleProfileAction />
        </RoleProfileProvider>,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "My role" }));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "DEV" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(identityToken).toHaveBeenCalledOnce();
    const mutation = vi
      .mocked(fetchAPI)
      .mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(mutation?.[1]?.body as string)).toEqual({
      role: "DEV",
      matrix_access_token: "current-proof",
    });
    fireEvent.click(screen.getByRole("button", { name: "My role" }));
    expect(
      (screen.getByLabelText("Role or custom title") as HTMLInputElement).value,
    ).toBe("DEV");
  });

  it("shares a role lookup across repeated appearances of the same author", async () => {
    vi.mocked(fetchAPI).mockResolvedValue(
      new Response(JSON.stringify({ "@alice:localhost": "PO" })),
    );
    render(
      withQueries(
        <>
          <UserRoleBadge userId="@alice:localhost" />
          <UserRoleBadge userId="@alice:localhost" />
        </>,
      ),
    );
    await waitFor(() => expect(screen.getAllByText("PO")).toHaveLength(2));
    expect(fetchAPI).toHaveBeenCalledOnce();
  });

  it("renders no empty badge and shows custom roles as plain text", () => {
    const view = render(<RoleBadge role="" />);
    expect(view.container.textContent).toBe("");
    view.rerender(<RoleBadge role="<script>" />);
    expect(view.container.textContent).toBe("<script>");
    expect(view.container.querySelector("script")).toBeNull();
  });

  it("resolves the current person's thread author marker to their chat identity", async () => {
    vi.mocked(fetchAPI).mockResolvedValue(
      new Response(JSON.stringify({ "@viewer:localhost": "DEV" })),
    );
    render(withQueries(<UserRoleBadge userId="me" />));
    await waitFor(() => expect(screen.getByText("DEV")).toBeTruthy());
    expect(fetchAPI).toHaveBeenCalledWith(
      "user-roles/",
      { params: { id: "@viewer:localhost" } },
      { redirectOn40x: false },
    );
  });
});
