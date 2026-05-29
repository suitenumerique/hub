import {
  createClient,
  IndexedDBCryptoStore,
  IndexedDBStore,
  MatrixClient,
} from "matrix-js-sdk/lib/matrix";
import { MatrixUserInterface } from "./types";

export const initClient = async (
  user: MatrixUserInterface,
): Promise<MatrixClient> => {
  const indexedDBStore = new IndexedDBStore({
    indexedDB: global.indexedDB,
    localStorage: global.localStorage,
    dbName: 'hub-web-sync-store',
  });

  const legacyCryptoStore = new IndexedDBCryptoStore(
    global.indexedDB,
    `crypto-store-${user.homeserverUrl}-${user.mxId}`
  );
  console.log("*** user in init client", user);
  const mx = createClient({
    baseUrl: user.homeserverUrl,
    accessToken: user.accessToken,
    refreshToken: user.refreshToken,
    userId: user.mxId,
    store: indexedDBStore,
    cryptoStore: legacyCryptoStore,
    deviceId: user.deviceId,
    timelineSupport: true,
    cryptoCallbacks: {},
    verificationMethods: ['m.sas.v1'],
  });

  try {
    await indexedDBStore.startup();
    await mx.initRustCrypto();

    return mx;
  } catch (err) {
    console.log('**** err in init client', err);
    await mx.clearStores();
    await mx.initRustCrypto();
    return mx;
  }
};

export const startClient = async (mx: MatrixClient) => {
  await mx.startClient({
    lazyLoadMembers: true,
  });
};
