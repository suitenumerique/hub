import {
  ClientEvent,
  createClient,
  IndexedDBCryptoStore,
  IndexedDBStore,
  MatrixClient,
  MatrixError,
  RoomNameType,
  SyncState,
  type RoomNameState,
  type SyncStateData,
  type TokenRefreshFunction,
} from "matrix-js-sdk/lib/matrix";

import i18n from "@/i18n/initI18n";

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

  return { mx, indexedDBStore, cryptoStoreDbName };
};

const startupClient = async ({
  mx,
  indexedDBStore,
  cryptoStoreDbName,
}: MatrixClientStores): Promise<MatrixClient> => {
  // Validate (and refresh when possible) the persisted OIDC session before
  // opening either IndexedDB store. A local MAS/Synapse reset invalidates both
  // tokens; letting Rust Crypto discover that first produces several failing
  // key requests before the driver can start a fresh login.
  await mx.whoami();
  await indexedDBStore.startup();
  await discardStaleJoinedRooms(mx, indexedDBStore);
  await mx.initRustCrypto({ cryptoDatabasePrefix: cryptoStoreDbName });
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
): Promise<void> => {
  const savedSync = await indexedDBStore.getSavedSync();
  const cachedJoinedRoomIds = Object.keys(savedSync?.roomsData.join ?? {});
  if (cachedJoinedRoomIds.length === 0) {
    return;
  }

  const { joined_rooms: serverJoinedRooms } = await mx.getJoinedRooms();
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
    return await startupClient(client);
  } catch (error) {
    // A homeserver response cannot be repaired by deleting IndexedDB. In
    // particular, let M_UNKNOWN_TOKEN/401 reach MatrixDriver so it can clear
    // the stored session and restart OIDC after `make reset-matrix`.
    if (error instanceof MatrixError) {
      throw error;
    }
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
  const currentData = mx.getSyncStateData();
  if (
    current === SyncState.Syncing &&
    currentData?.fromCache !== true &&
    currentData?.catchingUp !== true
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
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
    // Without this opt-in the SDK leaves m.thread replies in the main timeline
    // and never builds Room/Thread models.
    threadSupport: true,
  });
  await waitForInitialSync(mx);
};
