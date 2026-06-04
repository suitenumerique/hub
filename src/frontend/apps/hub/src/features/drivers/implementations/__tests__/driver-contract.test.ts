import { describe, expect, it, vi } from "vitest";

import { MockDriver } from "../MockDriver";

// Verifies the generic connection/real-time defaults of the Driver contract
// through MockDriver, so any backend that needs no handshake (mock, cookie
// session…) works out of the box and never blocks the UI or refetches.
describe("Driver generic contract (via MockDriver)", () => {
  it("connects immediately with no chat user and no handshake", async () => {
    const driver = new MockDriver();

    const state = await driver.connect({
      id: "u-1",
      email: "ada@example.com",
      language: null,
    });

    expect(state).toEqual({ status: "connected", chatUser: null });
  });

  it("treats lifecycle hooks as no-ops", () => {
    const driver = new MockDriver();

    expect(() => driver.initialize()).not.toThrow();
    expect(() => driver.destroy()).not.toThrow();
  });

  it("returns a no-op global event subscription that never fires", () => {
    const driver = new MockDriver();
    const listener = vi.fn();

    const unsubscribe = driver.subscribeToEvents(listener);

    expect(listener).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });
});
