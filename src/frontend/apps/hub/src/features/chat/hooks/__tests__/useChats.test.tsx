// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DriverEntry } from "@/features/drivers/DriverRegistry";
import type { HubGroup, LocalChatSections } from "@/features/drivers/types";

import { chatKeys } from "../../chatKeys";
import { decorateChatSections } from "../../chatRefs";

import { useChats } from "../useChats";

const localSections = (name: string): LocalChatSections => ({
  favourites: [],
  all: [
    {
      id: "same-chat-id",
      name,
      section: "all",
      kind: "hub_group",
      participantIds: [],
      visual: { kind: "initials" },
    },
  ],
});

const getChatsA = vi.fn(() => Promise.resolve(localSections("Account A room")));
const getChatsB = vi.fn(() => Promise.resolve(localSections("Account B room")));
const resolveHubGroups = vi.hoisted(() => vi.fn());

let entries: DriverEntry[] = [
  {
    accountId: "account-a",
    kind: "mock",
    label: "A",
    criticality: "required",
    enabled: true,
    driver: { getChats: getChatsA } as unknown as DriverEntry["driver"],
  },
  {
    accountId: "account-b",
    kind: "mock",
    label: "B",
    criticality: "optional",
    enabled: true,
    driver: { getChats: getChatsB } as unknown as DriverEntry["driver"],
  },
];

vi.mock("@/features/drivers/DriverRegistry", () => ({
  useDriverEntries: () => entries,
}));

vi.mock("@/features/config/HubApi", () => ({
  getHubApi: () => ({ resolveHubGroups }),
}));

const matrixSections = (): LocalChatSections => ({
  favourites: [],
  all: Array.from({ length: 50 }, (_value, index) => ({
    id: `!room-${index}:localhost`,
    name: `Room ${index}`,
    section: "all" as const,
    kind: "multi_party" as const,
    participantIds: [`@user-${index}:localhost`],
    visual: { kind: "icon" as const, icon: "groups" },
    ...(index === 4 || index === 41 ? { hubGroupCandidate: true } : {}),
  })),
});

const resolvedGroup = (roomId: string): HubGroup => ({
  id: `group-${roomId}`,
  status: "active",
  name: "Official group",
  ministry: "",
  tags: [],
  visibility: "private",
  emoji: "🌲",
  allow_external_guests: false,
  member_count: 0,
  matrix: null,
  members: [
    {
      mxid: "@hub-bot:localhost",
      hub_user_id: null,
      display_name: "Hub bot",
      role: "bot",
    },
  ],
  rooms: [
    {
      room_id: roomId,
      role: "active",
      sequence: 0,
    },
  ],
});

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

describe("useChats", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getChatsA.mockClear();
    getChatsB.mockClear();
    resolveHubGroups.mockReset();
    entries = [
      {
        accountId: "account-a",
        kind: "mock",
        label: "A",
        criticality: "required",
        enabled: true,
        driver: { getChats: getChatsA } as unknown as DriverEntry["driver"],
      },
      {
        accountId: "account-b",
        kind: "mock",
        label: "B",
        criticality: "optional",
        enabled: true,
        driver: { getChats: getChatsB } as unknown as DriverEntry["driver"],
      },
    ];
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("keeps identical local chat ids distinct across accounts", async () => {
    const { result } = renderHook(() => useChats(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.all).toHaveLength(2));

    expect(result.current.all.map((chat) => chat.ref)).toEqual([
      { accountId: "account-a", chatId: "same-chat-id" },
      { accountId: "account-b", chatId: "same-chat-id" },
    ]);
    expect(result.current.byAccount.get("account-a")?.all[0].name).toBe(
      "Account A room",
    );
    expect(result.current.byAccount.get("account-b")?.all[0].name).toBe(
      "Account B room",
    );
  });

  it("sends only Matrix candidates and keeps forged markers unclassified", async () => {
    const getChats = vi.fn(async () => matrixSections());
    entries = [
      {
        accountId: "matrix-local",
        kind: "matrix",
        label: "Matrix",
        criticality: "required",
        enabled: true,
        driver: {
          getChats,
          supportsHubGroupCreation: true,
          getMatrixIdentityProof: async () => ({
            mxid: "@alice:localhost",
            accessToken: "proof",
          }),
        } as unknown as DriverEntry["driver"],
      },
    ];
    const group = resolvedGroup("!room-4:localhost");
    group.rooms[0].sequence = 1;
    group.rooms.unshift({
      room_id: "!room-3:localhost",
      role: "predecessor",
      sequence: 0,
    });
    resolveHubGroups.mockResolvedValue([group]);

    const { result } = renderHook(() => useChats(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() =>
      expect(resolveHubGroups).toHaveBeenCalledWith({
        matrix_account_id: "matrix-local",
        matrix_access_token: "proof",
        room_ids: ["!room-41:localhost", "!room-4:localhost"],
      }),
    );
    await waitFor(() =>
      expect(
        result.current.all.find((chat) => chat.id === "!room-4:localhost")
          ?.kind,
      ).toBe("hub_group"),
    );
    expect(result.current.all).toHaveLength(49);
    expect(
      result.current.all.some((chat) => chat.id === "!room-3:localhost"),
    ).toBe(false);
    expect(
      result.current.all.find((chat) => chat.id === "!room-41:localhost")?.kind,
    ).toBe("multi_party");
  });

  it("keeps Matrix conversations visible while Django resolution fails", async () => {
    entries = [
      {
        accountId: "matrix-local",
        kind: "matrix",
        label: "Matrix",
        criticality: "required",
        enabled: true,
        driver: {
          getChats: vi.fn(async () => matrixSections()),
          supportsHubGroupCreation: true,
          getMatrixIdentityProof: async () => ({
            mxid: "@alice:localhost",
            accessToken: "proof",
          }),
        } as unknown as DriverEntry["driver"],
      },
    ];
    resolveHubGroups.mockRejectedValue(new Error("Django unavailable"));

    const { result } = renderHook(() => useChats(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.all).toHaveLength(50));
    expect(result.current.isError).toBe(false);
    expect(
      result.current.all.every((chat) => chat.kind === "multi_party"),
    ).toBe(true);
  });

  it("upgrades a candidate after a later successful resolution", async () => {
    entries = [
      {
        accountId: "matrix-local",
        kind: "matrix",
        label: "Matrix",
        criticality: "required",
        enabled: true,
        driver: {
          getChats: vi.fn(async () => matrixSections()),
          supportsHubGroupCreation: true,
          getMatrixIdentityProof: async () => ({
            mxid: "@alice:localhost",
            accessToken: "proof",
          }),
        } as unknown as DriverEntry["driver"],
      },
    ];
    resolveHubGroups
      .mockRejectedValueOnce(new Error("Temporary outage"))
      .mockResolvedValue([resolvedGroup("!room-4:localhost")]);

    const { result } = renderHook(() => useChats(), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(result.current.all).toHaveLength(50));
    expect(
      result.current.all.find((chat) => chat.id === "!room-4:localhost")?.kind,
    ).toBe("multi_party");
    await waitFor(
      () =>
        expect(
          result.current.all.find((chat) => chat.id === "!room-4:localhost")
            ?.kind,
        ).toBe("hub_group"),
      { timeout: 3_000 },
    );
    expect(resolveHubGroups).toHaveBeenCalledTimes(2);
  });

  it("keeps the last confirmed groups when a changed shortlist fails", async () => {
    entries = [
      {
        accountId: "matrix-local",
        kind: "matrix",
        label: "Matrix",
        criticality: "required",
        enabled: true,
        driver: {
          getChats: vi.fn(async () => matrixSections()),
          supportsHubGroupCreation: true,
          getMatrixIdentityProof: async () => ({
            mxid: "@alice:localhost",
            accessToken: "proof",
          }),
        } as unknown as DriverEntry["driver"],
      },
    ];
    resolveHubGroups.mockResolvedValueOnce([
      resolvedGroup("!room-4:localhost"),
    ]);

    const { result } = renderHook(() => useChats(), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() =>
      expect(
        result.current.all.find((chat) => chat.id === "!room-4:localhost")
          ?.kind,
      ).toBe("hub_group"),
    );

    resolveHubGroups.mockRejectedValue(new Error("Temporary outage"));
    const changedSections = matrixSections();
    changedSections.all[5] = {
      ...changedSections.all[5],
      hubGroupCandidate: true,
    };
    act(() => {
      queryClient.setQueryData(
        chatKeys.chatsOf("matrix-local"),
        decorateChatSections("matrix-local", changedSections),
      );
    });

    await waitFor(() => expect(resolveHubGroups).toHaveBeenCalledTimes(4), {
      timeout: 3_000,
    });
    expect(
      result.current.all.find((chat) => chat.id === "!room-4:localhost")?.kind,
    ).toBe("hub_group");
    expect(result.current.isError).toBe(false);
  });
});
