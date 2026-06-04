// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatRef } from "@/features/drivers/types";

import { useChat } from "../useChat";

const getChat = vi.fn();
const registry = {
  get: vi.fn(() => ({ getChat })),
};

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => registry,
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
      kind: "group",
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
});
