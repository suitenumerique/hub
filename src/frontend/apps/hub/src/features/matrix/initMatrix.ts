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

type MatrixClientStores = {
  mx: MatrixClient;
  indexedDBStore: IndexedDBStore;
  cryptoStoreDbName: string;
};

const DEFAULT_SYNC_STORE_DB_NAME = "matrix-web-sync-store";
const DEFAULT_CRYPTO_STORE_DB_NAME = "crypto-store";

const buildClient = (
  user: MatrixUserInterface,
  options: InitClientOptions,
): MatrixClientStores => {
  const indexedDBStore = new IndexedDBStore({
    indexedDB: global.indexedDB,
    localStorage: global.localStorage,
    dbName: options.syncStoreDbName ?? DEFAULT_SYNC_STORE_DB_NAME,
  });
  const cryptoStoreDbName =
    options.cryptoStoreDbName ?? DEFAULT_CRYPTO_STORE_DB_NAME;

  const legacyCryptoStore = new IndexedDBCryptoStore(
    global.indexedDB,
    cryptoStoreDbName,
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

  return { mx, indexedDBStore, cryptoStoreDbName };
};

const startupClient = async ({
  mx,
  indexedDBStore,
  cryptoStoreDbName,
}: MatrixClientStores): Promise<MatrixClient> => {
  await indexedDBStore.startup();
  await mx.initRustCrypto({ cryptoDatabasePrefix: cryptoStoreDbName });
  return mx;
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
  const client = buildClient(user, options);
  try {
    return await startupClient(client);
  } catch (error) {
    // A corrupt local store is the usual cause; reset it and retry once so the
    // user is not stuck behind a broken cache.
    console.error(
      "initClient: store startup failed, clearing and retrying",
      error,
    );
    await client.mx.clearStores({
      cryptoDatabasePrefix: client.cryptoStoreDbName,
    });
    return startupClient(buildClient(user, options));
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
    // Required for the SDK to organise `m.thread` replies into `Room.getThreads()`
    // / thread timelines instead of leaving them in the main room timeline.
    threadSupport: true,
  });
  await waitForInitialSync(mx);
};
