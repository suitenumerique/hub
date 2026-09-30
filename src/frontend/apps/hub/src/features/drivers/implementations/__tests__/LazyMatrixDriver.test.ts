import { afterEach, describe, expect, it, vi } from "vitest";

import type { Driver } from "../../Driver";
import { LazyMatrixDriver } from "../LazyMatrixDriver";
import { clearStoredConversationSearch } from "../matrixStorage";

vi.mock("../matrixStorage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../matrixStorage")>()),
  clearStoredConversationSearch: vi.fn(async () => {}),
}));

const owner = "hub@example.com";
const sessionLock = "hub-matrix:session:matrixUser:hub@example.com:matrix";

describe("LazyMatrixDriver.logout", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const mockLock = (available: boolean) => {
    const request = vi.fn(async (_name, _options, callback) => {
      await callback(available ? { name: sessionLock } : null);
    });
    vi.stubGlobal("navigator", { locks: { request } });
    return request;
  };

  it.each([true, false])(
    "clears a never-loaded projection only with session ownership: %s",
    async (available) => {
      const request = mockLock(available);
      const driver = new LazyMatrixDriver("matrix", { loginHint: owner });

      await driver.logout();

      expect(request).toHaveBeenCalledWith(
        sessionLock,
        { mode: "exclusive", ifAvailable: true },
        expect.any(Function),
      );
      expect(clearStoredConversationSearch).toHaveBeenCalledTimes(
        available ? 1 : 0,
      );
      if (available)
        expect(clearStoredConversationSearch).toHaveBeenCalledWith(
          "matrix",
          owner,
        );
    },
  );

  it("waits for pending loading and shutdown before cleaning stored data", async () => {
    mockLock(true);
    const driver = new LazyMatrixDriver("matrix", { loginHint: owner });
    let finishLoading!: (driver: Driver) => void;
    let finishLogout!: () => void;
    const logout = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLogout = resolve;
        }),
    );
    const shutdown = vi.fn(async () => {});
    const target = { logout, shutdown } as unknown as Driver;
    (driver as unknown as { targetPromise: Promise<Driver> }).targetPromise =
      new Promise<Driver>((resolve) => {
        finishLoading = resolve;
      });

    const work = driver.logout();
    expect(clearStoredConversationSearch).not.toHaveBeenCalled();
    finishLoading(target);
    await Promise.resolve();
    expect(logout).toHaveBeenCalledOnce();
    expect(clearStoredConversationSearch).not.toHaveBeenCalled();
    finishLogout();
    await work;

    expect(shutdown).toHaveBeenCalledOnce();
    expect(clearStoredConversationSearch).toHaveBeenCalledWith("matrix", owner);
  });

  it("still cleans under the session lock when loading fails", async () => {
    mockLock(true);
    const driver = new LazyMatrixDriver("matrix", { loginHint: owner });
    (driver as unknown as { targetPromise: Promise<Driver> }).targetPromise =
      Promise.reject(new Error("Module unavailable"));

    await expect(driver.logout()).rejects.toThrow("Module unavailable");
    expect(clearStoredConversationSearch).toHaveBeenCalledWith("matrix", owner);
  });
});
