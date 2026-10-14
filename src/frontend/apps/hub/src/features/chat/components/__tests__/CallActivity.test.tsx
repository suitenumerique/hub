// @vitest-environment jsdom
import "@/i18n/initI18n";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type HubApi,
  resetHubApiForTests,
  setHubApiForTests,
} from "@/features/config/HubApi";
import type { Call } from "@/features/drivers/types";

import { CallActivity, getCallDurationInMinutes } from "../CallActivity";

const CALL: Call = {
  id: "call-1",
  chat_service_id: "!room:matrix.test",
  url: "https://visio.test/abc-defg-hij",
  status: "ongoing",
  started_at: "2026-10-05T09:00:00Z",
  ended_at: null,
};

const renderActivity = (getCall: HubApi["getCall"]) => {
  setHubApiForTests({ getCall } as HubApi);
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CallActivity
        call={{ id: CALL.id, url: CALL.url }}
        timestamp={CALL.started_at}
      />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  resetHubApiForTests();
});

describe("CallActivity", () => {
  it("offers to join an ongoing call", async () => {
    renderActivity(vi.fn(async () => CALL));

    const join = await screen.findByRole("link", { name: "Join" });

    expect(join.getAttribute("href")).toBe(CALL.url);
    expect(join.getAttribute("target")).toBe("_blank");
    expect(screen.getByText("Meeting started")).toBeTruthy();
  });

  it("shows the duration of an ended call, without a way to join it", async () => {
    renderActivity(
      vi.fn(async () => ({
        ...CALL,
        status: "ended" as const,
        ended_at: "2026-10-05T09:42:30Z",
      })),
    );

    expect(await screen.findByText("Meeting ended")).toBeTruthy();
    expect(screen.getByText(/\(42 min\)/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Join" })).toBeNull();
  });

  it("does not offer to join a call whose status is unknown", async () => {
    const getCall = vi.fn(async () => {
      throw new Error("unreachable");
    });
    renderActivity(getCall);

    await vi.waitFor(() => expect(getCall).toHaveBeenCalled());

    expect(screen.getByText("Meeting started")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Join" })).toBeNull();
  });
});

describe("getCallDurationInMinutes", () => {
  it("counts whole minutes", () => {
    expect(
      getCallDurationInMinutes("2026-10-05T09:00:00Z", "2026-10-05T10:05:59Z"),
    ).toBe(65);
  });

  it("ignores a call that is ongoing or that nobody joined", () => {
    expect(getCallDurationInMinutes("2026-10-05T09:00:00Z", null)).toBeNull();
    expect(
      getCallDurationInMinutes("2026-10-05T09:00:00Z", "2026-10-05T09:00:00Z"),
    ).toBeNull();
  });
});
