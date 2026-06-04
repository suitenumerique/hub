import {
  ClientEvent,
  createClient,
  IndexedDBCryptoStore,
  IndexedDBStore,
  MatrixClient,
  SyncState,
  type TokenRefreshFunction,
} from "matrix-js-sdk/lib/matrix";

import { MatrixUserInterface } from "./types";

type InitClientOptions = {
  syncStoreDbName?: string;
  cryptoStoreDbName?: string;
  /**
   * Called by the SDK when a request hits an expired access token. Without it,
   * the SDK cannot refresh OIDC tokens and treats the 401 as a hard logout.
   */
  tokenRefreshFunction?: TokenRefreshFunction;
};

/**
 * Builds and bootstraps a Matrix client backed by IndexedDB stores. The whole
 * stack (IndexedDB, localStorage) is browser-only — callers must guard against
 * SSR; this app is a static export, so there is no server runtime anyway.
 */
export const initClient = async (
  user: MatrixUserInterface,
  options: InitClientOptions = {},
): Promise<MatrixClient> => {
  const indexedDBStore = new IndexedDBStore({
    indexedDB: global.indexedDB,
    localStorage: global.localStorage,
    dbName: options.syncStoreDbName ?? "matrix-web-sync-store",
  });

  const legacyCryptoStore = new IndexedDBCryptoStore(
    global.indexedDB,
    options.cryptoStoreDbName ?? "crypto-store",
  );

  const mx = createClient({
    baseUrl: user.homeserverUrl,
    accessToken: user.accessToken,
    refreshToken: user.refreshToken,
    tokenRefreshFunction: options.tokenRefreshFunction,
    userId: user.mxId,
    store: indexedDBStore,
    cryptoStore: legacyCryptoStore,
    deviceId: user.deviceId,
    timelineSupport: true,
    cryptoCallbacks: {},
    verificationMethods: ["m.sas.v1"],
  });

  try {
    await indexedDBStore.startup();
    await mx.initRustCrypto();
    return mx;
  } catch (error) {
    // A corrupt local store is the usual cause; reset it and retry once so the
    // user is not stuck behind a broken cache.
    console.error(
      "initClient: store startup failed, clearing and retrying",
      error,
    );
    await mx.clearStores();
    await mx.initRustCrypto();
    return mx;
  }
};

/** Sync states at which the store is populated and rooms can be read. */
const SYNC_READY_STATES: SyncState[] = [SyncState.Prepared, SyncState.Syncing];

/**
 * Resolves once the client's first `/sync` has populated the store (`PREPARED`,
 * possibly straight from the IndexedDB cache). Without this, callers see a
 * "connected" client whose rooms/timelines are still empty, so a refresh on a
 * conversation reads `null` rooms until the next focus-triggered refetch.
 */
const waitForInitialSync = (mx: MatrixClient): Promise<void> => {
  const current = mx.getSyncState();
  if (current && SYNC_READY_STATES.includes(current)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onSync = (state: SyncState) => {
      if (SYNC_READY_STATES.includes(state)) {
        mx.off(ClientEvent.Sync, onSync);
        resolve();
      } else if (state === SyncState.Error || state === SyncState.Stopped) {
        mx.off(ClientEvent.Sync, onSync);
        reject(new Error(`Matrix initial sync failed: ${state}`));
      }
    };
    mx.on(ClientEvent.Sync, onSync);
  });
};

export const startClient = async (mx: MatrixClient): Promise<void> => {
  await mx.startClient({
    lazyLoadMembers: true,
  });
  await waitForInitialSync(mx);
};
