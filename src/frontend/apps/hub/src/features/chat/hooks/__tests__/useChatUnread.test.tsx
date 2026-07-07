// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DriverEntry } from "@/features/drivers/DriverRegistry";
import type { ChatUnread } from "@/features/drivers/types";

import { useChatUnread } from "../useChatUnread";

const getUnread = vi.fn(
  async (): Promise<Record<string, ChatUnread>> => ({
    "chat-1": { unread: true, highlight: false },
    "chat-2": { unread: true, highlight: true },
  }),
);

const entries: DriverEntry[] = [
  {
    accountId: "account-a",
    kind: "mock",
    label: "A",
    criticality: "required",
    enabled: true,
    driverInstanceId: 1,
    settingsFingerprint: "null",
    driver: { getUnread } as unknown as DriverEntry["driver"],
  },
];

vi.mock("@/features/drivers/DriverRegistry", () => ({
  useDriverEntries: () => entries,
}));

describe("useChatUnread", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getUnread.mockClear();
  });

  afterEach(() => queryClient.clear());

  const renderLookup = () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    Wrapper.displayName = "TestQueryClientProvider";
    return renderHook(() => useChatUnread(), { wrapper: Wrapper });
  };

  it("looks up a conversation's read state from its account slice", async () => {
    const { result } = renderLookup();

    await waitFor(() => {
      expect(
        result.current({ accountId: "account-a", chatId: "chat-2" }),
      ).toEqual({ unread: true, highlight: true });
    });
    expect(
      result.current({ accountId: "account-a", chatId: "chat-1" }),
    ).toEqual({ unread: true, highlight: false });
  });

  it("defaults unknown conversations to read", () => {
    const { result } = renderLookup();

    expect(
      result.current({ accountId: "account-a", chatId: "unknown" }),
    ).toEqual({ unread: false, highlight: false });
  });
});
