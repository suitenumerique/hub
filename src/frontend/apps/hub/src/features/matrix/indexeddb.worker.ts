import { IndexedDBStoreWorker } from "matrix-js-sdk/lib/indexeddb-worker";

// Same entry point as Element's workers/indexeddb.worker.ts: the sync store
// loads, accumulates and saves its cache here, off the main thread.
const scope = self as unknown as Worker;
const remoteWorker = new IndexedDBStoreWorker(scope.postMessage.bind(scope));
scope.onmessage = remoteWorker.onMessage;
