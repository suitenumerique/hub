import { IndexedDBStore, MemoryStore } from "matrix-js-sdk/lib/matrix";

// Public persistence methods of IndexedDBStore 41.6.0. A stopped SDK sync can
// finish its current batch after stopClient(); it must never touch a closed DB.
const persistentMethods = [
  "startup",
  "getSavedSync",
  "isNewlyCreated",
  "getSavedSyncToken",
  "deleteAllData",
  "save",
  "setSyncData",
  "getOutOfBandMembers",
  "setOutOfBandMembers",
  "clearOutOfBandMembers",
  "getClientOptions",
  "storeClientOptions",
  "getPendingEvents",
  "setPendingEvents",
  "saveToDeviceBatches",
  "getOldestToDeviceBatch",
  "removeToDeviceBatch",
  "getUserProfile",
  "storeUserProfiles",
  "removeUserProfiles",
] as const satisfies readonly (keyof IndexedDBStore & keyof MemoryStore)[];

/** Retire persistent access immediately, then drain writes before closing. */
export const ownSyncStore = (store: IndexedDBStore): (() => Promise<void>) => {
  const pending = new Set<Promise<unknown>>();
  const retiredStore = new MemoryStore();
  let retired = false;
  let closing: Promise<void> | undefined;
  for (const name of persistentMethods) {
    const original = store[name];
    const fallback = retiredStore[name];
    Reflect.set(store, name, (...args: unknown[]) => {
      // Late SDK work may finish in memory, but must not reopen persistence
      // after another tab is allowed to acquire the same database.
      if (retired) return Reflect.apply(fallback, retiredStore, args);
      const work = Promise.resolve(Reflect.apply(original, store, args));
      pending.add(work);
      void work.finally(() => pending.delete(work)).catch(() => {});
      return work;
    });
  }
  return () => {
    retired = true;
    closing ??= (async () => {
      while (pending.size) await Promise.allSettled([...pending]);
      await store.destroy();
    })();
    return closing;
  };
};
