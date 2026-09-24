import {
  ClientEvent,
  createClient,
  IndexedDBCryptoStore,
  IndexedDBStore,
  MatrixClient,
  RoomNameType,
  SyncState,
  type RoomNameState,
  type SyncStateData,
  type TokenRefreshFunction,
} from "matrix-js-sdk/lib/matrix";

import i18n from "@/i18n/initI18n";

import { MatrixUserInterface } from "./types";
import { ownSyncStore } from "./ownedSyncStore";

type InitClientOptions = {
  /** Recheck ownership and client generation after asynchronous startup steps. */
  assertActive?: () => void;
  syncStoreDbName?: string;
  cryptoStoreDbName?: string;
  /**
   * Called by the SDK when a request hits an expired access token. Without it,
   * the SDK cannot refresh OIDC tokens and treats the 401 as a hard logout.
   */
  tokenRefreshFunction?: TokenRefreshFunction;
  /** Optional local projections attach after cache repair, before sync starts. */
  onSyncStoreReady?: (mx: MatrixClient) => Promise<void>;
};

type MatrixClientStores = {
  mx: MatrixClient;
  indexedDBStore: IndexedDBStore;
  cryptoStoreDbName: string;
};

const DEFAULT_SYNC_STORE_DB_NAME = "matrix-web-sync-store";
const DEFAULT_CRYPTO_STORE_DB_NAME = "crypto-store";
const stores = new WeakMap<MatrixClient, () => Promise<void>>();
const startingClients = new WeakMap<MatrixClient, Promise<void>>();
const closingClients = new WeakMap<MatrixClient, Promise<void>>();

export class MatrixStorageContinuityError extends Error {}

/** Stop crypto first, then close (never delete) the independent sync database. */
export const closeMatrixClient = (mx: MatrixClient): Promise<void> => {
  const existing = closingClients.get(mx);
  if (existing) return existing;
  // startClient awaits server capabilities before constructing its sync loop.
  // Stopping before that prelude finishes would allow the loop to start late.
  mx.http.abort();
  const work = (async () => {
    await Promise.allSettled([startingClients.get(mx)]);
    mx.stopClient();
    mx.http.abort();
    await stores.get(mx)?.();
  })();
  closingClients.set(mx, work);
  return work;
};

const localizedRoomNameGenerator = (
  _roomId: string,
  state: RoomNameState,
): string | null => {
  if (state.type !== RoomNameType.EmptyRoom) {
    return null;
  }
  return state.oldName
    ? i18n.t("{{name}} left the conversation", { name: state.oldName })
    : i18n.t("Empty conversation");
};

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
    roomNameGenerator: localizedRoomNameGenerator,
    // Hub does not expose Matrix calls yet. Keeping VoIP off avoids the SDK's
    // startup TURN polling (`/voip/turnServer`), which is noisy in local MAS.
    disableVoip: true,
    cryptoCallbacks: {},
    verificationMethods: ["m.sas.v1"],
  });

  stores.set(mx, ownSyncStore(indexedDBStore));
  return { mx, indexedDBStore, cryptoStoreDbName };
};

const startupClient = async (
  { mx, indexedDBStore, cryptoStoreDbName }: MatrixClientStores,
  user: MatrixUserInterface,
  assertActive: () => void,
): Promise<MatrixClient> => {
  // Validate (and refresh when possible) the persisted OIDC session before
  // opening either IndexedDB store. A local MAS/Synapse reset invalidates both
  // tokens; letting Rust Crypto discover that first produces several failing
  // key requests before the driver can start a fresh login.
  const identity = await mx.whoami();
  assertActive();
  if (
    !user.deviceId ||
    identity.user_id !== user.mxId ||
    identity.device_id !== user.deviceId
  ) {
    throw new MatrixStorageContinuityError(
      "Matrix session identity does not match this device.",
    );
  }
  // Query public keys before Rust can create/upload any device identity. A
  // published device with a missing local store requires explicit recovery.
  const keys = await mx.downloadKeysForUsers([user.mxId]);
  assertActive();
  const published = keys.device_keys?.[user.mxId]?.[user.deviceId]?.keys;
  if (published) {
    if (!indexedDB.databases) {
      throw new MatrixStorageContinuityError(
        "Cannot check existing crypto storage in this browser.",
      );
    }
    const databases = await indexedDB.databases();
    assertActive();
    if (
      !databases.some(
        ({ name }) => name === `${cryptoStoreDbName}::matrix-sdk-crypto`,
      )
    ) {
      throw new MatrixStorageContinuityError(
        "The keys for this device are missing from this browser.",
      );
    }
  }
  await indexedDBStore.startup();
  assertActive();
  await discardStaleJoinedRooms(mx, indexedDBStore, assertActive);
  assertActive();
  await mx.initRustCrypto({ cryptoDatabasePrefix: cryptoStoreDbName });
  assertActive();
  if (published) {
    const own = await mx.getCrypto()!.getOwnDeviceKeys();
    assertActive();
    if (
      published[`ed25519:${user.deviceId}`] !== own.ed25519 ||
      published[`curve25519:${user.deviceId}`] !== own.curve25519
    ) {
      throw new MatrixStorageContinuityError(
        "The local device keys do not match the published identity.",
      );
    }
  }
  return mx;
};

/**
 * The sync store is independent from Synapse. After `make reset-matrix`, it
 * can therefore contain joined rooms which no longer exist on the server.
 * matrix-js-sdk replays that cached sync before its first network `/sync`; a
 * cached thread then tries to fetch its deleted root event and raises an
 * unhandled 403/404.
 *
 * `/joined_rooms` is authoritative for current joined membership. Clear only
 * the sync cache when it contradicts the server, preserving the OIDC session
 * and the separate Rust Crypto store.
 */
const discardStaleJoinedRooms = async (
  mx: MatrixClient,
  indexedDBStore: IndexedDBStore,
  assertActive: () => void,
): Promise<void> => {
  const savedSync = await indexedDBStore.getSavedSync();
  assertActive();
  const cachedJoinedRoomIds = Object.keys(savedSync?.roomsData.join ?? {});
  if (cachedJoinedRoomIds.length === 0) {
    return;
  }

  const { joined_rooms: serverJoinedRooms } = await mx.getJoinedRooms();
  assertActive();
  const serverJoinedRoomIds = new Set(serverJoinedRooms);
  const hasStaleJoinedRoom = cachedJoinedRoomIds.some(
    (roomId) => !serverJoinedRoomIds.has(roomId),
  );
  if (!hasStaleJoinedRoom) {
    return;
  }

  console.info(
    "initClient: stale joined rooms found in the sync cache, clearing it",
  );
  await indexedDBStore.deleteAllData();
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
    const assertActive = options.assertActive ?? (() => {});
    assertActive();
    const mx = await startupClient(client, user, assertActive);
    await options.onSyncStoreReady?.(mx);
    assertActive();
    return mx;
  } catch (error) {
    await closeMatrixClient(client.mx);
    throw error;
  }
};

const INITIAL_SYNC_LIMIT = 50;

/**
 * Resolves once the client's first real `/sync` completed. `PREPARED` may come
 * only from IndexedDB; waiting for `SYNCING` avoids exposing stale cached rooms
 * after a local homeserver reset.
 */
const waitForInitialSync = (
  mx: MatrixClient,
  signal?: AbortSignal,
): Promise<void> => {
  signal?.throwIfAborted();
  const current = mx.getSyncState();
  const currentData = mx.getSyncStateData();
  if (
    current === SyncState.Syncing &&
    currentData?.fromCache !== true &&
    currentData?.catchingUp !== true
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      mx.off(ClientEvent.Sync, onSync);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Client stopped", "AbortError"));
    };
    const onSync = (
      state: SyncState,
      _previousState: SyncState | null,
      data?: SyncStateData,
    ) => {
      if (
        state === SyncState.Syncing &&
        data?.fromCache !== true &&
        data?.catchingUp !== true
      ) {
        cleanup();
        resolve();
      } else if (state === SyncState.Error || state === SyncState.Stopped) {
        cleanup();
        reject(new Error(`Matrix initial sync failed: ${state}`));
      }
    };
    mx.on(ClientEvent.Sync, onSync);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
};

export const startClient = async (
  mx: MatrixClient,
  signal?: AbortSignal,
): Promise<void> => {
  signal?.throwIfAborted();
  const starting = mx.startClient({
    initialSyncLimit: INITIAL_SYNC_LIMIT,
    lazyLoadMembers: true,
    // Without this opt-in the SDK leaves m.thread replies in the main timeline
    // and never builds Room/Thread models.
    threadSupport: true,
  });
  startingClients.set(mx, starting);
  await starting;
  signal?.throwIfAborted();
  await waitForInitialSync(mx, signal);
};
