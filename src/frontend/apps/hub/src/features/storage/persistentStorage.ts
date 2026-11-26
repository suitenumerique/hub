import { trackEvent } from "@/features/analytics/analytics";

export type StoragePersistence =
  | "persisted"
  | "granted"
  | "denied"
  | "unsupported";

/**
 * Asks the browser to keep this site's storage when disk space runs low, as
 * Element does (`tryPersistStorage`). Chrome and the browsers built on it
 * otherwise delete the IndexedDB of the least recently used sites once less
 * than 2 GB of disk is free, open tabs included, and keep their
 * localStorage: the chat then loses the keys of its device (#153).
 *
 * Chrome answers alone, from how much the site is used, bookmarked,
 * installed or allowed to send notifications. Firefox asks the person.
 */
export const requestPersistentStorage =
  async (): Promise<StoragePersistence> => {
    const storage = globalThis.navigator?.storage;
    if (!storage?.persist) return "unsupported";
    try {
      // Firefox would ask again. As in Element, a failed check still asks.
      if (await storage.persisted?.()) return "persisted";
    } catch {
      // Ask below.
    }
    try {
      return (await storage.persist()) ? "granted" : "denied";
    } catch {
      return "unsupported";
    }
  };

const usageMegabytes = async (): Promise<number | undefined> => {
  try {
    const { usage } = await navigator.storage.estimate();
    return usage === undefined ? undefined : Math.round(usage / 1_000_000);
  } catch {
    return undefined;
  }
};

let reported: StoragePersistence | null = null;

/**
 * Requests persistent storage and reports the answer when it changes during
 * the page: a later request, once notifications are allowed, may get it.
 */
export const keepSiteStorage = async (): Promise<void> => {
  const result = await requestPersistentStorage();
  if (result === reported) return;
  reported = result;
  trackEvent("storage:persistence", {
    result,
    usage_mb: result === "unsupported" ? undefined : await usageMegabytes(),
  });
};
