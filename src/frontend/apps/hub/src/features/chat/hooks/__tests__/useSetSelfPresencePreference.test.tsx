// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "../../chatKeys";
import { useSetSelfPresencePreference } from "../useSetSelfPresencePreference";

const { registryGet, setSelfPresencePreference, notifyBrand, notifyError } =
  vi.hoisted(() => ({
    registryGet: vi.fn(),
    setSelfPresencePreference: vi.fn(),
    notifyBrand: vi.fn(),
    notifyError: vi.fn(),
  }));

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => ({ get: registryGet }),
}));
vi.mock("@/features/ui/components/toast", () => ({
  notify: { brand: notifyBrand, error: notifyError },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const wrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientProvider";
  return Wrapper;
};

describe("useSetSelfPresencePreference", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    registryGet.mockReset();
    setSelfPresencePreference.mockReset();
    notifyBrand.mockReset();
    notifyError.mockReset();
    registryGet.mockReturnValue({
      setSelfPresencePreference,
      getCurrentUserId: () => "@me:localhost",
    });
    setSelfPresencePreference.mockResolvedValue(undefined);
  });

  afterEach(() => queryClient.clear());

  it.each(["online", "offline"] as const)(
    "publishes and caches the %s preference through the requested account",
    async (preference) => {
      const { result } = renderHook(
        () => useSetSelfPresencePreference("account-b"),
        { wrapper: wrapper(queryClient) },
      );

      act(() => result.current.setSelfPresencePreference(preference));
      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(registryGet).toHaveBeenCalledWith("account-b");
      expect(setSelfPresencePreference).toHaveBeenCalledWith(preference);
      expect(notifyBrand).toHaveBeenCalledOnce();
      expect(
        queryClient.getQueryData(chatKeys.selfPresencePreference("account-b")),
      ).toBe(preference);
      expect(
        queryClient.getQueryData(
          chatKeys.userPresence("account-b", "@me:localhost"),
        ),
      ).toEqual({ userId: "@me:localhost", state: preference });
    },
  );

  it("does not cache a failed preference", async () => {
    queryClient.setQueryData(
      chatKeys.selfPresencePreference("account-a"),
      "offline",
    );
    setSelfPresencePreference.mockRejectedValue(new Error("network"));
    const { result } = renderHook(
      () => useSetSelfPresencePreference("account-a"),
      { wrapper: wrapper(queryClient) },
    );

    act(() => result.current.setSelfPresencePreference("online"));
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(notifyError).toHaveBeenCalledOnce();
    expect(
      queryClient.getQueryData(chatKeys.selfPresencePreference("account-a")),
    ).toBe("offline");
  });
});
