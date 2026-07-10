// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMembers, ChatRef } from "@/features/drivers/types";

import { useChatMembers } from "../useChatMembers";

const getChatMembers = vi.fn<(chatId: string) => Promise<ChatMembers>>();
const registry = { get: vi.fn(() => ({ getChatMembers })) };

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

describe("useChatMembers", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getChatMembers.mockReset();
    registry.get.mockClear();
  });

  afterEach(() => queryClient.clear());

  it("waits for the modal to open before loading members", async () => {
    getChatMembers.mockResolvedValue({
      present: [{ id: "me", name: "Me", secondaryText: "me@example.test" }],
      pendingInvites: [
        { id: "alice", name: "Alice", secondaryText: "alice@example.test" },
      ],
    });

    const { result, rerender } = renderHook(
      ({ enabled }) => useChatMembers(CHAT_REF, enabled),
      { initialProps: { enabled: false }, wrapper: wrapper(queryClient) },
    );

    expect(getChatMembers).not.toHaveBeenCalled();
    expect(result.current.present).toEqual([]);

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.present).toHaveLength(1));

    expect(getChatMembers).toHaveBeenCalledWith("chat-1");
    expect(result.current.pendingInvites[0].name).toBe("Alice");
  });
});
