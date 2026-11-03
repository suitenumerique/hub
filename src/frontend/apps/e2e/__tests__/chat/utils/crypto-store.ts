import type { Page } from "@playwright/test";

export type HeldRoomKeys = {
  /** Lets the Hub read its room keys again. */
  release: () => Promise<void>;
};

/**
 * Keeps the Hub from reading the room keys of its encryption store until
 * `release`: a message received meanwhile stays "decrypting", a state that
 * otherwise lasts a few milliseconds. A read-write transaction on the store
 * of the keys (`inbound_group_sessions…` in the Rust SDK's
 * `…::matrix-sdk-crypto` database), kept alive by a chain of requests, makes
 * every other transaction on it wait.
 *
 * The Hub must already hold the key of the messages to come: receiving a new
 * one would wait too, and with it the whole sync.
 */
export const holdRoomKeyReads = async (page: Page): Promise<HeldRoomKeys> => {
  const key = `__hold_${Math.random().toString(36).slice(2)}`;
  await page.evaluate(async (key) => {
    const names = (await indexedDB.databases())
      .map(({ name }) => name)
      .filter((name) => name?.endsWith("::matrix-sdk-crypto"));
    const [name] = names;
    if (names.length !== 1 || !name) {
      throw new Error(`Expected one encryption store, found ${names.length}.`);
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const storeName = Array.from(database.objectStoreNames).find((name) =>
      name.startsWith("inbound_group_sessions"),
    );
    if (!storeName) {
      throw new Error("The encryption store has no room keys store.");
    }
    const state = { holding: true };
    (window as unknown as Record<string, unknown>)[key] = state;
    const transaction = database.transaction(storeName, "readwrite");
    transaction.oncomplete = () => database.close();
    const store = transaction.objectStore(storeName);
    // Settles once the transaction runs, so the store is held from then on.
    await new Promise<void>((resolve) => {
      const keepAlive = () => {
        resolve();
        if (state.holding) {
          store.count().onsuccess = keepAlive;
        }
      };
      store.count().onsuccess = keepAlive;
    });
  }, key);
  return {
    release: () =>
      page.evaluate((key) => {
        (
          (window as unknown as Record<string, unknown>)[key] as {
            holding: boolean;
          }
        ).holding = false;
      }, key),
  };
};
