import {
  ClientEvent,
  createClient,
  IndexedDBCryptoStore,
  IndexedDBStore,
  MatrixClient,
  RoomNameType,
  SyncState,
  type RoomNameState,
  type TokenRefreshFunction,
} from "matrix-js-sdk/lib/matrix";

import i18n from "@/i18n/initI18n";

import { saveOnMembershipChange } from "./membershipSave";
import { MatrixUserInterface } from "./types";
import { ownSyncStore } from "./ownedSyncStore";
import { preloadRustCrypto } from "./preloadRustCrypto";

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
  /**
   * Optional local projections attach after cache repair, before sync starts.
   * `joinedRoomIds` is the server's `/joined_rooms` answer fetched during
   * startup, or null when that request failed.
   */
  onSyncStoreReady?: (
    mx: MatrixClient,
    joinedRoomIds: string[] | null,
  ) => Promise<void>;
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
const handOverSavedSync = new WeakMap<MatrixClient, () => void>();
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
    ? i18n.t("{{name}} left the chat", { name: state.oldName })
    : i18n.t("Empty chat");
};

/** A command the SDK's worker backend posts, answered by the same `seq`. */
type SyncStoreWorkerCommand = { command?: string; seq?: number };

/**
 * Like Element (createMatrixClient.ts), the sync store runs its IndexedDB
 * backend in a worker: loading, accumulating and saving the cache (about
 * 10 MB on Tchap) no longer blocks the main thread.
 *
 * The SDK's worker backend answers its commands from `onmessage` only: if the
 * worker script fails to load (a stale chunk after a deployment) or the
 * worker dies, they would never settle, leaving sync and logout hanging. A
 * failed worker answers them with an error instead, so the store degrades to
 * memory as it does when IndexedDB itself fails.
 *
 * Its first command, `setupWorker`, is left to the SDK: it watches `onerror`
 * while starting and then falls back to IndexedDB on the main thread, and an
 * answer to that command would only be an unhandled rejection.
 */
const createSyncStoreWorker = (): Worker => {
  const worker = new Worker(new URL("./indexeddb.worker.ts", import.meta.url));
  const pending = new Set<number>();
  let setupSeq: number | undefined;
  let failed = false;
  const answerFailure = (seq: number) => {
    worker.dispatchEvent(
      new MessageEvent("message", {
        data: {
          command: "cmd_fail",
          seq,
          error: { name: "Error", message: "The sync store worker failed." },
        },
      }),
    );
  };
  const post = worker.postMessage.bind(worker);
  worker.postMessage = ((command: SyncStoreWorkerCommand) => {
    const { seq } = command;
    if (command.command === "setupWorker") setupSeq = seq;
    if (failed) {
      if (seq !== undefined && seq !== setupSeq)
        queueMicrotask(() => answerFailure(seq));
      return;
    }
    if (seq !== undefined) pending.add(seq);
    post(command);
  }) as Worker["postMessage"];
  worker.addEventListener("message", (event: MessageEvent) => {
    const { seq } = (event.data ?? {}) as SyncStoreWorkerCommand;
    if (seq !== undefined) pending.delete(seq);
  });
  const fail = (event: Event) => {
    if (failed) return;
    failed = true;
    worker.terminate();
    // The SDK watches `onerror` only: report an unreadable message as an error
    // so that a store still starting falls back instead of waiting forever.
    if (event.type !== "error") {
      worker.dispatchEvent(
        new ErrorEvent("error", { message: "The sync store worker failed." }),
      );
    }
    for (const seq of [...pending]) {
      if (seq !== setupSeq) answerFailure(seq);
    }
  };
  worker.addEventListener("error", fail);
  worker.addEventListener("messageerror", fail);
  return worker;
};

const buildClient = (
  user: MatrixUserInterface,
  options: InitClientOptions,
): MatrixClientStores => {
  const indexedDBStore = new IndexedDBStore({
    indexedDB: global.indexedDB,
    localStorage: global.localStorage,
    dbName: options.syncStoreDbName ?? DEFAULT_SYNC_STORE_DB_NAME,
    workerFactory:
      typeof Worker === "undefined" ? undefined : createSyncStoreWorker,
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

  saveOnMembershipChange(indexedDBStore);
  stores.set(mx, ownSyncStore(indexedDBStore));
  return { mx, indexedDBStore, cryptoStoreDbName };
};

const startupClient = async (
  { mx, indexedDBStore, cryptoStoreDbName }: MatrixClientStores,
  user: MatrixUserInterface,
  assertActive: () => void,
): Promise<string[] | null> => {
  // Validate (and refresh when possible) the persisted OIDC session before
  // opening either IndexedDB store. A local MAS/Synapse reset invalidates both
  // tokens; letting Rust Crypto discover that first produces several failing
  // key requests before the driver can start a fresh login.
  // The public keys and joined rooms do not depend on that check and load in
  // parallel: the SDK shares one token refresh between the requests, and a
  // failed check still wins (closing the client aborts the others).
  const identityRequest = mx.whoami();
  const keysRequest = mx.downloadKeysForUsers([user.mxId]);
  const joinedRoomsRequest = mx.getJoinedRooms();
  keysRequest.catch(() => {});
  joinedRoomsRequest.catch(() => {});
  const identity = await identityRequest;
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
  const keys = await keysRequest;
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
  const savedSync = await indexedDBStore.getSavedSync();
  assertActive();
  shareSavedSync(
    mx,
    indexedDBStore,
    await discardStaleJoinedRooms(
      indexedDBStore,
      savedSync,
      joinedRoomsRequest,
      assertActive,
    ),
  );
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
  // The driver reuses this answer for its first conversation list.
  return joinedRoomsRequest.then(
    ({ joined_rooms: joinedRooms }) => joinedRooms,
    () => null,
  );
};

/**
 * The sync store is independent from Synapse. After `make reset-matrix`, it
 * can therefore contain joined rooms which no longer exist on the server.
 * matrix-js-sdk replays that cached sync before its first network `/sync`; a
 * cached thread then tries to fetch its deleted root event and raises an
 * unhandled 403/404.
 *
 * `/joined_rooms` is authoritative for current joined membership. When none
 * of the cached rooms is still joined, the cache belongs to a reset server:
 * clear it, preserving the OIDC session and the separate Rust Crypto store.
 * Otherwise the person left some rooms, for instance from another client:
 * only those rooms stay out of the replay, and the next `/sync` reports the
 * departures. Clearing the whole cache for them would force a full initial
 * sync, several seconds and megabytes on Tchap.
 */
const discardStaleJoinedRooms = async (
  indexedDBStore: IndexedDBStore,
  savedSync: SavedSync,
  joinedRoomsRequest: ReturnType<MatrixClient["getJoinedRooms"]>,
  assertActive: () => void,
): Promise<SavedSync> => {
  const cachedJoinedRooms = savedSync?.roomsData.join ?? {};
  const cachedJoinedRoomIds = Object.keys(cachedJoinedRooms);
  if (cachedJoinedRoomIds.length === 0) {
    return savedSync;
  }

  const { joined_rooms: serverJoinedRooms } = await joinedRoomsRequest;
  assertActive();
  const serverJoinedRoomIds = new Set(serverJoinedRooms);
  const staleRoomIds = cachedJoinedRoomIds.filter(
    (roomId) => !serverJoinedRoomIds.has(roomId),
  );
  if (staleRoomIds.length === 0) {
    return savedSync;
  }
  if (staleRoomIds.length < cachedJoinedRoomIds.length) {
    for (const roomId of staleRoomIds) delete cachedJoinedRooms[roomId];
    return savedSync;
  }

  console.info(
    "initClient: no cached joined room is still joined, clearing the sync cache",
  );
  await indexedDBStore.deleteAllData();
  return null;
};

type SavedSync = Awaited<ReturnType<IndexedDBStore["getSavedSync"]>>;

/**
 * `getSavedSync` deep-copies the whole sync accumulator, about 10 MB for a
 * Tchap account. The cache repair, the search projection and the SDK replay
 * all read it before the first `/sync`: they share this one copy. Only the
 * SDK mutates it, and it reads last, from `startClient`.
 *
 * A cleared cache shares `null` with no sync token: the in-memory accumulator
 * outlives `deleteAllData`, and the SDK would otherwise replay it.
 */
const shareSavedSync = (
  mx: MatrixClient,
  store: IndexedDBStore,
  savedSync: SavedSync,
): void => {
  const readSavedSync = store.getSavedSync;
  const readSavedSyncToken = store.getSavedSyncToken;
  let shared = savedSync;
  let handingOver = false;
  store.getSavedSyncToken = () => Promise.resolve(shared?.nextBatch ?? null);
  store.getSavedSync = () => {
    const data = shared;
    if (handingOver) {
      // The SDK replay owns the copy now; later reads see the live store.
      shared = null;
      store.getSavedSync = readSavedSync;
      store.getSavedSyncToken = readSavedSyncToken;
    }
    return Promise.resolve(data);
  };
  handOverSavedSync.set(mx, () => {
    handingOver = true;
  });
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
  preloadRustCrypto();
  const client = buildClient(user, options);
  try {
    const assertActive = options.assertActive ?? (() => {});
    assertActive();
    const joinedRoomIds = await startupClient(client, user, assertActive);
    await options.onSyncStoreReady?.(client.mx, joinedRoomIds);
    assertActive();
    return client.mx;
  } catch (error) {
    await closeMatrixClient(client.mx);
    throw error;
  }
};

// Element's value: only the first sync without a cache uses it.
const INITIAL_SYNC_LIMIT = 20;

const isPrepared = (state: SyncState | null): boolean =>
  state === SyncState.Prepared || state === SyncState.Syncing;

/**
 * Resolves at the first `PREPARED`, like Element's `firstSyncPromise`
 * (MatrixChat.tsx). On a warm start the SDK emits it with `fromCache: true`
 * once the IndexedDB sync cache is replayed, before any network `/sync`, so
 * the chat renders from the cache. `initClient` has already dropped rooms the
 * server no longer lists as joined, and the driver re-reads the visible rooms
 * on the first network `SYNCING`.
 *
 * `onPrepared` runs inside that sync event, before the SDK processes anything
 * else: listeners it adds observe the whole first network `/sync`.
 */
const waitForPrepared = (
  mx: MatrixClient,
  signal?: AbortSignal,
  onPrepared?: () => void,
): Promise<void> => {
  signal?.throwIfAborted();
  if (isPrepared(mx.getSyncState())) {
    onPrepared?.();
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
    const onSync = (state: SyncState) => {
      if (isPrepared(state)) {
        cleanup();
        onPrepared?.();
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
  onPrepared?: () => void,
): Promise<void> => {
  signal?.throwIfAborted();
  // Listen before starting: the cache replay can emit PREPARED early.
  const prepared = waitForPrepared(mx, signal, onPrepared);
  prepared.catch(() => {});
  handOverSavedSync.get(mx)?.();
  handOverSavedSync.delete(mx);
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
  await prepared;
};
