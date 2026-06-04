// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DriverEntry } from "@/features/drivers/DriverRegistry";
import type { LocalChatSections } from "@/features/drivers/types";

import { useChats } from "../useChats";

const localSections = (name: string): LocalChatSections => ({
  favourites: [],
  all: [
    {
      id: "same-chat-id",
      name,
      section: "all",
      kind: "group",
      participantIds: [],
      visual: { kind: "initials" },
    },
  ],
});

const getChatsA = vi.fn(() => Promise.resolve(localSections("Account A room")));
const getChatsB = vi.fn(() => Promise.resolve(localSections("Account B room")));

const entries: DriverEntry[] = [
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
});
