// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatRef } from "@/features/drivers/types";

import { useMarkChatRead } from "../useMarkChatRead";

const markChatRead = vi.fn();

const registry = {
  get: vi.fn(() => ({ markChatRead })),
};

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => registry,
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };

describe("useMarkChatRead", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    markChatRead.mockReset();
    markChatRead.mockResolvedValue(undefined);
    registry.get.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderMarkRead = (ref: ChatRef | null) => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    Wrapper.displayName = "TestQueryClientProvider";
    return renderHook(() => useMarkChatRead(ref), { wrapper: Wrapper });
  };

  it("marks the conversation read through its account driver", async () => {
    const { result } = renderMarkRead(CHAT_REF);

    act(() => {
      result.current();
    });

    await waitFor(() => {
      expect(registry.get).toHaveBeenCalledWith("account-a");
      expect(markChatRead).toHaveBeenCalledWith("chat-1");
    });
  });

  it("is a no-op without a conversation", async () => {
    const { result } = renderMarkRead(null);

    act(() => {
      result.current();
    });
    await Promise.resolve();

    expect(markChatRead).not.toHaveBeenCalled();
  });
});
