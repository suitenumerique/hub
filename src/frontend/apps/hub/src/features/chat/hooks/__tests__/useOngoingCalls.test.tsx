// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type HubApi,
  resetHubApiForTests,
  setHubApiForTests,
} from "@/features/config/HubApi";
import type { ApiConfig, Call } from "@/features/drivers/types";

import { useOngoingCalls } from "../useOngoingCalls";

const CALL: Call = {
  id: "call-1",
  chat_service_id: "!b:matrix.test",
  url: "https://visio.test/abc-defg-hij",
  status: "ongoing",
  started_at: "2026-10-05T09:00:00Z",
  ended_at: null,
};

const renderOngoingCalls = (config: ApiConfig, chatIds: string[]) => {
  const getOngoingCalls = vi.fn(async () => [CALL]);
  setHubApiForTests({
    getConfig: async () => config,
    getOngoingCalls,
  } as unknown as HubApi);
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    getOngoingCalls,
    ...renderHook(() => useOngoingCalls(chatIds), { wrapper }),
  };
};

afterEach(() => {
  resetHubApiForTests();
});

describe("useOngoingCalls", () => {
  it("returns the conversations in which a call is ongoing", async () => {
    const { result, getOngoingCalls } = renderOngoingCalls(
      { MEET_ENABLED: true },
      ["!b:matrix.test", "!a:matrix.test"],
    );

    await waitFor(() =>
      expect(result.current.has("!b:matrix.test")).toBe(true),
    );

    expect(result.current.has("!a:matrix.test")).toBe(false);
    expect(getOngoingCalls).toHaveBeenCalledWith([
      "!a:matrix.test",
      "!b:matrix.test",
    ]);
  });

  it("asks nothing when calls are not available", async () => {
    const { result, getOngoingCalls } = renderOngoingCalls({}, [
      "!b:matrix.test",
    ]);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(getOngoingCalls).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });
});
