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
    // Hub does not expose Matrix calls yet. Keeping VoIP off avoids the SDK's
    // startup TURN polling (`/voip/turnServer`), which is noisy in local MAS.
    disableVoip: true,
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

const INITIAL_SYNC_LIMIT = 50;

/**
 * Resolves once the client's first real `/sync` completed. `PREPARED` may come
 * only from IndexedDB; waiting for `SYNCING` avoids exposing stale cached rooms
 * after a local homeserver reset.
 */
const waitForInitialSync = (mx: MatrixClient): Promise<void> => {
  const current = mx.getSyncState();
  if (current === SyncState.Syncing) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onSync = (state: SyncState) => {
      if (state === SyncState.Syncing) {
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
    initialSyncLimit: INITIAL_SYNC_LIMIT,
    lazyLoadMembers: true,
  });
  await waitForInitialSync(mx);
};
