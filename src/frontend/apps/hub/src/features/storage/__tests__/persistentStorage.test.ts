import { afterEach, describe, expect, it, vi } from "vitest";

import { requestPersistentStorage } from "../persistentStorage";

const withStorage = (storage: Partial<StorageManager> | undefined) =>
  vi.stubGlobal("navigator", { storage });

describe("requestPersistentStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a browser without the Storage API", async () => {
    withStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBe("unsupported");
  });

  it("does not ask again for storage already kept", async () => {
    const persist = vi.fn();
    withStorage({ persisted: async () => true, persist });
    await expect(requestPersistentStorage()).resolves.toBe("persisted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("asks the browser to keep the storage", async () => {
    withStorage({ persisted: async () => false, persist: async () => true });
    await expect(requestPersistentStorage()).resolves.toBe("granted");
    withStorage({ persisted: async () => false, persist: async () => false });
    await expect(requestPersistentStorage()).resolves.toBe("denied");
  });

  it("still asks when the browser cannot tell whether it keeps it", async () => {
    withStorage({
      persisted: () => Promise.reject(new DOMException("", "SecurityError")),
      persist: async () => true,
    });
    await expect(requestPersistentStorage()).resolves.toBe("granted");
  });

  it("never fails when the browser refuses to answer", async () => {
    withStorage({
      persisted: async () => false,
      persist: () => Promise.reject(new DOMException("", "SecurityError")),
    });
    await expect(requestPersistentStorage()).resolves.toBe("unsupported");
  });
});
