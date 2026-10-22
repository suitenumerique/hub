// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage, ChatRef } from "@/features/drivers/types";

import { useEnsureMessageDecrypted } from "../useEnsureMessageDecrypted";

const ensureMessageDecrypted = vi.fn();

vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => ({ get: () => ({ ensureMessageDecrypted }) }),
}));

const CHAT_REF: ChatRef = { accountId: "account-a", chatId: "chat-1" };

describe("useEnsureMessageDecrypted", () => {
  beforeEach(() => ensureMessageDecrypted.mockReset());

  it.each<ChatMessage["availability"]>([
    "encrypted-pending",
    "encrypted-unavailable",
    "encrypted-error",
  ])("asks the driver to decrypt a %s message", (availability) => {
    renderHook(() => useEnsureMessageDecrypted(CHAT_REF, "m-1", availability));

    expect(ensureMessageDecrypted).toHaveBeenCalledWith("chat-1", "m-1");
  });

  it.each<ChatMessage["availability"]>([
    undefined,
    "clear",
    "unsupported-media",
  ])("leaves a %s message alone", (availability) => {
    renderHook(() => useEnsureMessageDecrypted(CHAT_REF, "m-1", availability));

    expect(ensureMessageDecrypted).not.toHaveBeenCalled();
  });

  it("asks once per message while it stays encrypted", () => {
    const { rerender } = renderHook(
      ({ availability }) =>
        useEnsureMessageDecrypted(CHAT_REF, "m-1", availability),
      { initialProps: { availability: "encrypted-pending" as const } },
    );
    rerender({ availability: "encrypted-pending" });

    expect(ensureMessageDecrypted).toHaveBeenCalledTimes(1);
  });
});
