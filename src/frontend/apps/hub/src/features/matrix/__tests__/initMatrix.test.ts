import { createClient } from "matrix-js-sdk/lib/matrix";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initClient } from "../initMatrix";
import type { MatrixUserInterface } from "../types";

const matrixMocks = vi.hoisted(() => ({
  cryptoStoreDbNames: [] as string[],
  createClient: vi.fn(),
}));

vi.mock("matrix-js-sdk/lib/matrix", () => {
  class IndexedDBStore {
    startup = vi.fn(async () => undefined);
  }

  class IndexedDBCryptoStore {
    constructor(_indexedDB: unknown, dbName: string) {
      matrixMocks.cryptoStoreDbNames.push(dbName);
    }
  }

  return {
    ClientEvent: { Sync: "sync" },
    createClient: matrixMocks.createClient,
    IndexedDBCryptoStore,
    IndexedDBStore,
    SyncState: {
      Prepared: "PREPARED",
      Syncing: "SYNCING",
      Error: "ERROR",
      Stopped: "STOPPED",
    },
  };
});

const USER: MatrixUserInterface = {
  homeserverUrl: "http://localhost:9808",
  mxId: "@hub:localhost",
  deviceId: "device-one",
  accessToken: "access-token",
};

const makeMatrixClient = () => ({
  clearStores: vi.fn(async () => undefined),
  initRustCrypto: vi.fn(async () => undefined),
});

describe("initClient", () => {
  beforeEach(() => {
    matrixMocks.cryptoStoreDbNames = [];
    vi.clearAllMocks();
    vi.stubGlobal("indexedDB", {});
    vi.stubGlobal("localStorage", {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the configured crypto store name for legacy and Rust crypto stores", async () => {
    const cryptoStoreDbName = "crypto-store:@hub:localhost:device-one";
    const mx = makeMatrixClient();
    vi.mocked(createClient).mockReturnValue(mx as never);

    await initClient(USER, {
      syncStoreDbName: "sync-store",
      cryptoStoreDbName,
    });

    expect(matrixMocks.cryptoStoreDbNames).toEqual([cryptoStoreDbName]);
    expect(mx.initRustCrypto).toHaveBeenCalledWith({
      cryptoDatabasePrefix: cryptoStoreDbName,
    });
  });

  it("clears the same Rust crypto store prefix before retrying a corrupt startup", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const cryptoStoreDbName = "crypto-store:@hub:localhost:device-two";
    const firstMx = makeMatrixClient();
    const secondMx = makeMatrixClient();
    firstMx.initRustCrypto.mockRejectedValueOnce(new Error("corrupt store"));
    vi.mocked(createClient)
      .mockReturnValueOnce(firstMx as never)
      .mockReturnValueOnce(secondMx as never);

    await initClient(USER, {
      syncStoreDbName: "sync-store",
      cryptoStoreDbName,
    });

    expect(firstMx.clearStores).toHaveBeenCalledWith({
      cryptoDatabasePrefix: cryptoStoreDbName,
    });
    expect(consoleError).toHaveBeenCalledWith(
      "initClient: store startup failed, clearing and retrying",
      expect.any(Error),
    );
    expect(secondMx.initRustCrypto).toHaveBeenCalledWith({
      cryptoDatabasePrefix: cryptoStoreDbName,
    });
  });
});
