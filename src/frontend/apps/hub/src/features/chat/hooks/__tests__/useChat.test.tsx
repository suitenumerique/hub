// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatRef, HubGroup } from "@/features/drivers/types";

import { chatKeys } from "../../chatKeys";

import { useChat } from "../useChat";

const getChat = vi.fn();
const resolveHubGroups = vi.hoisted(() => vi.fn());
let driver: Record<string, unknown> = { getChat };
const registry = {
  get: vi.fn(() => driver),
};

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => registry,
}));

vi.mock("@/features/config/HubApi", () => ({
  getHubApi: () => ({ resolveHubGroups }),
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

describe("useChat", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getChat.mockReset();
    resolveHubGroups.mockReset();
    driver = { getChat };
    registry.get.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("loads and decorates a chat through the matching account driver", async () => {
    getChat.mockResolvedValueOnce({
      id: "chat-1",
      name: "General",
      section: "all",
      kind: "hub_group",
      visual: { kind: "initials" },
    });

    const { result } = renderHook(() => useChat(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.chat).not.toBeNull());

    expect(registry.get).toHaveBeenCalledWith("account-a");
    expect(getChat).toHaveBeenCalledWith("chat-1");
    expect(result.current.chat?.ref).toEqual(CHAT_REF);
  });

  it("stays idle without a selected chat ref", () => {
    const { result } = renderHook(() => useChat(null), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current.chat).toBeNull();
    expect(getChat).not.toHaveBeenCalled();
  });

  it("reuses the sidebar resolution instead of resolving the room again", async () => {
    const group: HubGroup = {
      id: "group-1",
      status: "active",
      emoji: "🌲",
      announcements_only: false,
      allow_external_guests: false,
      matrix: null,
      invitations: [],
      memberships: [],
      rooms: [
        {
          room_id: "chat-1",
          role: "active",
          sequence: 0,
          name: "Official group",
          topic: "",
          is_encrypted: false,
        },
      ],
    };
    driver = {
      getChat,
      supportsHubGroupCreation: true,
      getMatrixIdentityProof: vi.fn(),
    };
    getChat.mockResolvedValueOnce({
      id: "chat-1",
      name: "Official group",
      section: "all",
      kind: "multi_party",
      participantIds: [],
      visual: { kind: "icon", icon: "groups" },
      hubGroupCandidate: true,
    });
    queryClient.setQueryData(chatKeys.lastResolvedHubGroupsOf("account-a"), {
      candidateRoomIds: ["chat-1"],
      groups: [group],
    });

    const { result } = renderHook(() => useChat(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.chat?.kind).toBe("hub_group"));
    expect(resolveHubGroups).not.toHaveBeenCalled();
  });
});
