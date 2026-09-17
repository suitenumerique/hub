// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "@/features/chat/chatKeys";
import type { Chat, ChatMember } from "@/features/drivers/types";

import { ChatMembersModal } from "../ChatMembersModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  // The modal now reads role labels, which pulls `fetchAPI` and with it the
  // i18n bootstrap into this module graph. The mock has to cover it.
  initReactI18next: { type: "3rdParty", init: () => undefined },
}));

const members: ChatMember[] = [
  { id: "@alice:localhost", name: "Alice", secondaryText: "alice@test" },
  { id: "@bob:localhost", name: "Bob", secondaryText: "bob@test" },
  {
    id: "@unknown:localhost",
    name: "Unknown",
    secondaryText: "unknown@test",
  },
];
const getUserPresence = vi.fn(() => null);
const subscribeToEvents = vi.fn();

vi.mock("@/features/drivers/DriverRegistry", () => ({
  useDriverEntries: () => [
    {
      accountId: "account-a",
      driver: { getUserPresence, subscribeToEvents },
    },
  ],
}));

vi.mock("@/features/chat/hooks/useChatMembers", () => ({
  useChatMembers: () => ({
    present: members,
    pendingInvites: [],
    isInitialLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/features/chat/hooks/useMyAvatarSrc", () => ({
  useMyAvatarSrc: () => undefined,
}));

vi.mock("@/features/ui/components/avatar/useAvatarPortalOverlay", () => ({
  useAvatarPortalOverlay: vi.fn(),
}));

vi.mock("@gouvfr-lasuite/ui-components", () => ({
  Button: ({ children }: { children: ReactNode }) => (
    <button>{children}</button>
  ),
  ShareModal: ({
    accesses,
    children,
    isOpen,
    modalTitle,
  }: {
    accesses: Array<{
      id: string;
      user: { full_name: string; email: string };
    }>;
    children: ReactNode;
    isOpen: boolean;
    modalTitle: string;
  }) =>
    isOpen ? (
      <div className="c__share-modal" aria-label={modalTitle}>
        {children}
        <div className="c__share-modal__members">
          {accesses.map((access) => (
            <div
              className="c__share-member-item"
              data-testid={`member-${access.id}`}
              key={access.id}
            >
              <div className="c__user-row">
                <span className="c__user-row__name">
                  {access.user.full_name}
                </span>
                <span>{access.user.email}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null,
}));

const chat = {
  accountId: "account-a",
  ref: { accountId: "account-a", chatId: "room-a" },
} as Chat;

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

describe("ChatMembersModal presence", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getUserPresence.mockClear();
    subscribeToEvents.mockClear();
  });

  afterEach(() => queryClient.clear());

  it("associates account-scoped presence with the matching member", async () => {
    queryClient.setQueryData(
      chatKeys.userPresence("account-a", "@alice:localhost"),
      { userId: "@alice:localhost", state: "online" },
    );
    queryClient.setQueryData(
      chatKeys.userPresence("account-a", "@bob:localhost"),
      { userId: "@bob:localhost", state: "offline" },
    );
    queryClient.setQueryData(
      chatKeys.userPresence("account-b", "@alice:localhost"),
      { userId: "@alice:localhost", state: "unavailable" },
    );

    render(<ChatMembersModal chat={chat} isOpen onClose={vi.fn()} />, {
      wrapper: wrapper(queryClient),
    });

    const alice = await screen.findByTestId("member-@alice:localhost");
    const bob = screen.getByTestId("member-@bob:localhost");
    const unknown = screen.getByTestId("member-@unknown:localhost");
    expect(
      within(alice)
        .getByRole("img", { name: "Online" })
        .getAttribute("data-presence"),
    ).toBe("online");
    expect(
      within(bob)
        .getByRole("img", { name: "Offline" })
        .getAttribute("data-presence"),
    ).toBe("offline");
    expect(within(unknown).queryByRole("img")).toBeNull();
    expect(screen.queryByLabelText("Chat members")).not.toBeNull();
  });

  it("updates only the affected row when React Query receives a presence", async () => {
    const aliceKey = chatKeys.userPresence("account-a", "@alice:localhost");
    queryClient.setQueryData(aliceKey, {
      userId: "@alice:localhost",
      state: "online",
    });

    render(<ChatMembersModal chat={chat} isOpen onClose={vi.fn()} />, {
      wrapper: wrapper(queryClient),
    });
    const alice = await screen.findByTestId("member-@alice:localhost");
    expect(within(alice).queryByRole("img", { name: "Online" })).not.toBeNull();

    act(() => {
      queryClient.setQueryData(aliceKey, {
        userId: "@alice:localhost",
        state: "unavailable",
      });
    });

    await waitFor(() => {
      expect(
        within(alice)
          .getByRole("img", { name: "Offline" })
          .getAttribute("data-presence"),
      ).toBe("unavailable");
    });
    expect(subscribeToEvents).not.toHaveBeenCalled();
  });
});
