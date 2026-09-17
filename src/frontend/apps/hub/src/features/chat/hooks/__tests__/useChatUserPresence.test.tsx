// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { act, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "../../chatKeys";
import type { ChatUserPresence } from "@/features/drivers/types";

import { useChatUserPresence } from "../useChatUserPresence";

const getUserPresence = vi.fn<(userId: string) => ChatUserPresence | null>();
const subscribeToEvents = vi.fn();
const entries = [
  {
    accountId: "account-a",
    driver: { getUserPresence, subscribeToEvents },
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

describe("useChatUserPresence", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getUserPresence.mockReset();
    subscribeToEvents.mockReset();
  });

  afterEach(() => queryClient.clear());

  it("initializes the account-scoped cache from the driver's local store", async () => {
    getUserPresence.mockReturnValue({
      userId: "@alice:localhost",
      state: "online",
    });

    const { result } = renderHook(
      () => useChatUserPresence("account-a", "@alice:localhost"),
      { wrapper: wrapper(queryClient) },
    );

    await waitFor(() => expect(result.current?.state).toBe("online"));
    expect(getUserPresence).toHaveBeenCalledOnce();
    expect(getUserPresence).toHaveBeenCalledWith("@alice:localhost");
    expect(
      queryClient.getQueryData(
        chatKeys.userPresence("account-a", "@alice:localhost"),
      ),
    ).toEqual({ userId: "@alice:localhost", state: "online" });
  });

  it("returns and caches null when no presence is known", async () => {
    getUserPresence.mockReturnValue(null);

    const { result } = renderHook(
      () => useChatUserPresence("account-a", "@unknown:localhost"),
      { wrapper: wrapper(queryClient) },
    );

    await waitFor(() => expect(getUserPresence).toHaveBeenCalledOnce());
    expect(result.current).toBeNull();
    expect(
      queryClient.getQueryData(
        chatKeys.userPresence("account-a", "@unknown:localhost"),
      ),
    ).toBeNull();
  });

  it("reacts to online, unavailable and offline cache updates", async () => {
    getUserPresence.mockReturnValue({
      userId: "@alice:localhost",
      state: "online",
    });
    const key = chatKeys.userPresence("account-a", "@alice:localhost");
    const { result } = renderHook(
      () => useChatUserPresence("account-a", "@alice:localhost"),
      { wrapper: wrapper(queryClient) },
    );
    await waitFor(() => expect(result.current?.state).toBe("online"));

    for (const state of [
      "offline",
      "online",
      "unavailable",
      "online",
    ] as const) {
      act(() => {
        queryClient.setQueryData(key, {
          userId: "@alice:localhost",
          state,
        });
      });
      await waitFor(() => expect(result.current?.state).toBe(state));
    }
  });

  it("isolates user and account keys when its arguments change", async () => {
    getUserPresence.mockImplementation((userId) => ({
      userId,
      state: userId.includes("alice") ? "online" : "offline",
    }));
    const { result, rerender } = renderHook(
      ({ accountId, userId }) => useChatUserPresence(accountId, userId),
      {
        initialProps: {
          accountId: "account-a",
          userId: "@alice:localhost",
        },
        wrapper: wrapper(queryClient),
      },
    );
    await waitFor(() => expect(result.current?.state).toBe("online"));

    rerender({ accountId: "account-a", userId: "@bob:localhost" });
    await waitFor(() => expect(result.current?.state).toBe("offline"));

    rerender({ accountId: "account-b", userId: "@alice:localhost" });
    expect(result.current).toBeNull();
    expect(getUserPresence).toHaveBeenCalledTimes(2);
    expect(
      queryClient.getQueryData(
        chatKeys.userPresence("account-a", "@alice:localhost"),
      ),
    ).toEqual({ userId: "@alice:localhost", state: "online" });
    expect(
      queryClient.getQueryData(
        chatKeys.userPresence("account-a", "@bob:localhost"),
      ),
    ).toEqual({ userId: "@bob:localhost", state: "offline" });
  });

  it("does not subscribe to driver events", async () => {
    getUserPresence.mockReturnValue(null);

    renderHook(() => useChatUserPresence("account-a", "@alice:localhost"), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(getUserPresence).toHaveBeenCalledOnce());

    expect(subscribeToEvents).not.toHaveBeenCalled();
  });
});
