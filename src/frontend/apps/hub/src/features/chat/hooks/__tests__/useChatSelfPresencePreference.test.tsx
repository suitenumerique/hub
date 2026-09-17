// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "../../chatKeys";
import { useChatSelfPresencePreference } from "../useChatSelfPresencePreference";

const getSelfPresencePreference = vi.fn();
const entries = [
  {
    accountId: "account-a",
    driver: { getSelfPresencePreference },
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

describe("useChatSelfPresencePreference", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getSelfPresencePreference.mockReset();
  });

  afterEach(() => queryClient.clear());

  it.each(["online", "offline"] as const)(
    "initializes the persisted %s preference",
    async (preference) => {
      getSelfPresencePreference.mockReturnValue(preference);

      const { result } = renderHook(
        () => useChatSelfPresencePreference("account-a"),
        { wrapper: wrapper(queryClient) },
      );

      await waitFor(() => expect(result.current).toBe(preference));
      expect(
        queryClient.getQueryData(chatKeys.selfPresencePreference("account-a")),
      ).toBe(preference);
    },
  );

  it("keeps account preferences isolated", () => {
    queryClient.setQueryData(
      chatKeys.selfPresencePreference("account-a"),
      "online",
    );
    queryClient.setQueryData(
      chatKeys.selfPresencePreference("account-b"),
      "offline",
    );

    const { result } = renderHook(
      () => useChatSelfPresencePreference("account-a"),
      { wrapper: wrapper(queryClient) },
    );

    expect(result.current).toBe("online");
    expect(
      queryClient.getQueryData(chatKeys.selfPresencePreference("account-b")),
    ).toBe("offline");
  });
});
