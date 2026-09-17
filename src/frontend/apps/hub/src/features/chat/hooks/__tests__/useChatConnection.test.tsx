// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "../../chatKeys";
import type { User } from "@/features/drivers/types";

import { useChatConnections } from "../useChatConnection";
import { useChatUserPresence } from "../useChatUserPresence";

type TestDriver = {
  connect: ReturnType<typeof vi.fn>;
  getUserPresence: ReturnType<typeof vi.fn>;
};

let entries: Array<{
  accountId: string;
  label: string;
  criticality: "required";
  enabled: boolean;
  settingsFingerprint: string;
  driver: TestDriver;
}> = [];

vi.mock("@/features/drivers/DriverRegistry", () => ({
  useDriverEntries: () => entries,
}));

const connectedDriver = (state: "online" | "unavailable" | "offline") => ({
  connect: vi.fn().mockResolvedValue({ status: "connected", chatUser: null }),
  getUserPresence: vi.fn((userId: string) => ({ userId, state })),
});

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

describe("useChatConnections presence lifecycle", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    entries = [];
  });

  afterEach(() => queryClient.clear());

  it("reloads only the replaced account's presence from its new local store", async () => {
    const oldDriver = connectedDriver("online");
    const otherDriver = connectedDriver("offline");
    entries = [
      {
        accountId: "account-a",
        label: "Account A",
        criticality: "required",
        enabled: true,
        settingsFingerprint: "old",
        driver: oldDriver,
      },
      {
        accountId: "account-b",
        label: "Account B",
        criticality: "required",
        enabled: true,
        settingsFingerprint: "stable",
        driver: otherDriver,
      },
    ];
    const accountAKey = chatKeys.userPresence("account-a", "@alice:localhost");
    const accountBKey = chatKeys.userPresence("account-b", "@bob:localhost");
    queryClient.setQueryData(accountAKey, {
      userId: "@alice:localhost",
      state: "online",
    });
    queryClient.setQueryData(accountBKey, {
      userId: "@bob:localhost",
      state: "offline",
    });
    const user = { id: "hub-user" } as User;

    const { result, rerender } = renderHook(
      () => {
        const connection = useChatConnections(user);
        const presence = useChatUserPresence("account-a", "@alice:localhost");
        return { connection, presence };
      },
      { wrapper: wrapper(queryClient) },
    );
    await waitFor(() =>
      expect(result.current.connection.status).toBe("connected"),
    );
    await waitFor(() => expect(result.current.presence?.state).toBe("online"));

    const newDriver = connectedDriver("unavailable");
    entries = [
      { ...entries[0], settingsFingerprint: "new", driver: newDriver },
      entries[1],
    ];
    rerender();

    await waitFor(() =>
      expect(result.current.presence?.state).toBe("unavailable"),
    );
    expect(newDriver.connect).toHaveBeenCalledOnce();
    expect(newDriver.getUserPresence).toHaveBeenCalledWith("@alice:localhost");
    expect(queryClient.getQueryData(accountBKey)).toEqual({
      userId: "@bob:localhost",
      state: "offline",
    });
  });
});
