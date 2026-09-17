// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "@/features/chat/chatKeys";
import type { Chat } from "@/features/drivers/types";

import { ChatPresenceAvatar } from "../ChatPresenceAvatar";

const getUserPresence = vi.fn();

vi.mock("@/features/drivers/DriverRegistry", () => ({
  useDriverEntries: () => [
    { accountId: "account-a", driver: { getUserPresence } },
  ],
}));
vi.mock("@/features/chat/hooks/useAvatarSrc", () => ({
  useAvatarSrc: () => undefined,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const makeChat = (kind: Chat["kind"]): Chat => ({
  id: `${kind}-chat`,
  accountId: "account-a",
  ref: { accountId: "account-a", chatId: `${kind}-chat` },
  name: kind === "direct" ? "Alice" : "Team",
  section: "all",
  kind,
  participantIds:
    kind === "direct"
      ? ["@alice:localhost"]
      : ["@alice:localhost", "@bob:localhost"],
  visual: { kind: "initials" },
});

describe("ChatPresenceAvatar", () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getUserPresence.mockReset();
    getUserPresence.mockReturnValue(null);
  });

  afterEach(() => queryClient.clear());

  it("shows a DM counterpart and rerenders immediately from the presence cache", async () => {
    const key = chatKeys.userPresence("account-a", "@alice:localhost");
    queryClient.setQueryData(key, {
      userId: "@alice:localhost",
      state: "online",
    });
    render(<ChatPresenceAvatar chat={makeChat("direct")} />, { wrapper });

    expect(screen.getByRole("img", { name: "Online" })).not.toBeNull();
    act(() => {
      queryClient.setQueryData(key, {
        userId: "@alice:localhost",
        state: "offline",
      });
    });
    await waitFor(() =>
      expect(screen.getByRole("img", { name: "Offline" })).not.toBeNull(),
    );
  });

  it("does not render a user presence on a group room", () => {
    queryClient.setQueryData(
      chatKeys.userPresence("account-a", "@alice:localhost"),
      { userId: "@alice:localhost", state: "online" },
    );
    render(<ChatPresenceAvatar chat={makeChat("group")} />, { wrapper });

    expect(screen.queryByRole("img", { name: "Online" })).toBeNull();
    expect(getUserPresence).not.toHaveBeenCalled();
  });
});
