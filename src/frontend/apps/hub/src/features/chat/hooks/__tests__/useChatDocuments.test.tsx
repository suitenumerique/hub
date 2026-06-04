// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "../../chatKeys";
import type { ChatDocumentsPage, ChatRef } from "@/features/drivers/types";

import { useChatDocuments } from "../useChatDocuments";

const buildPage = (): ChatDocumentsPage => ({
  pinned: [
    { id: "p-1", title: "Pinned doc", mimetype: "text/plain", kind: "file" },
  ],
  shared: [
    {
      id: "s-1",
      title: "Shared image",
      mimetype: "image/jpeg",
      kind: "file",
      isShared: true,
    },
  ],
  multimedia: [
    {
      id: "m-1",
      title: "wikipedia.com",
      mimetype: "text/uri-list",
      kind: "link",
      url: "https://www.wikipedia.org",
    },
  ],
});

const getChatDocuments =
  vi.fn<(chatId: string) => Promise<ChatDocumentsPage>>();

const registry = {
  get: vi.fn(() => ({ getChatDocuments })),
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

describe("useChatDocuments", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getChatDocuments.mockReset();
    registry.get.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("reports loading then exposes the three document groups", async () => {
    getChatDocuments.mockResolvedValueOnce(buildPage());

    const { result } = renderHook(() => useChatDocuments(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.pinned).toEqual([]);

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(result.current.pinned).toHaveLength(1);
    expect(result.current.shared[0].id).toBe("s-1");
    expect(result.current.multimedia[0].kind).toBe("link");
    expect(result.current.isError).toBe(false);
  });

  it("keys the query by ChatRef", async () => {
    getChatDocuments.mockResolvedValue(buildPage());

    renderHook(
      () =>
        useChatDocuments({
          accountId: "account-b",
          chatId: "chat-1",
        }),
      {
        wrapper: wrapper(queryClient),
      },
    );
    await waitFor(() => {
      expect(getChatDocuments).toHaveBeenCalledWith("chat-1");
    });
    expect(registry.get).toHaveBeenCalledWith("account-b");
    expect(
      queryClient.getQueryData(
        chatKeys.documents({ accountId: "account-b", chatId: "chat-1" }),
      ),
    ).toBeDefined();
  });

  it("surfaces query errors without throwing", async () => {
    getChatDocuments.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useChatDocuments(CHAT_REF), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.pinned).toEqual([]);
    expect(result.current.isInitialLoading).toBe(false);
  });
});
