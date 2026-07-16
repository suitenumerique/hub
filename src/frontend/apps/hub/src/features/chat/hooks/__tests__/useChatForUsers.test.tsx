// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Chat, ChatSections } from "@/features/drivers/types";

import { useChatForUsers } from "../useChatForUsers";

const ACCOUNT_ID = "matrix-local";
const getChatForUsers = vi.fn();
let sections: ChatSections = { favourites: [], all: [] };

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => ({ get: () => ({ getChatForUsers }) }),
}));

vi.mock("../useChatAccounts", () => ({
  useComposerAccountId: () => ACCOUNT_ID,
}));

vi.mock("../useChats", () => ({
  useChats: () => ({
    favourites: sections.favourites,
    all: sections.all,
    byAccount: new Map([[ACCOUNT_ID, sections]]),
    accountErrors: new Map(),
    isResolvingHubGroups: false,
  }),
}));

const groupChat = (
  membership: "join" | "invite",
  participantIds: string[],
): Chat => ({
  id: "!group:localhost",
  accountId: ACCOUNT_ID,
  ref: { accountId: ACCOUNT_ID, chatId: "!group:localhost" },
  name: "Group",
  section: "all",
  kind: "hub_group",
  participantIds,
  membership,
  visual: { kind: "emoji", emoji: "🌲" },
});

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

describe("useChatForUsers", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    sections = { favourites: [], all: [] };
    getChatForUsers.mockReset();
    getChatForUsers.mockResolvedValue(null);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("keeps New Chat empty when an invitation has no visible participants", () => {
    sections.all = [groupChat("invite", [])];

    const { result } = renderHook(() => useChatForUsers([]), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current.chat).toBeNull();
    expect(getChatForUsers).not.toHaveBeenCalled();
  });

  it("does not preview a matching invitation before the user opens it", async () => {
    const participantIds = ["@alice:localhost", "@bob:localhost"];
    sections.all = [groupChat("invite", participantIds)];

    const { result } = renderHook(() => useChatForUsers(participantIds), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    expect(result.current.chat).toBeNull();
  });

  it("still reuses a joined group with the selected participants", () => {
    const participantIds = ["@alice:localhost", "@bob:localhost"];
    sections.all = [groupChat("join", participantIds)];

    const { result } = renderHook(() => useChatForUsers(participantIds), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current.chat?.id).toBe("!group:localhost");
  });
});
