import type { SearchRoom } from "./model";

export type SearchDelta = {
  id: string;
  count?: number | null;
  name?: string;
  alias?: string;
  members: { id: string; name: string; joined: boolean }[];
  invalid?: boolean;
};
export type SyncEdge = {
  oldToken?: string;
  token: string;
};
export type SearchCheckpoint = SyncEdge & {
  rooms: SearchDelta[];
  left: string[];
};
export type SearchSnapshot = {
  format: "classic-lazy-v2";
  token?: string;
  journal: SyncEdge[];
};
type StoredSnapshot = Omit<SearchSnapshot, "format"> & { format: string };
type Lease = { owner: string; generation: number; expires: number };

const requestValue = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

export const searchDatabaseName = (
  owner: string,
  accountId: string,
  homeserver: string,
  userId: string,
): string => {
  const url = new URL(homeserver);
  url.hash = "";
  url.search = "";
  return `hub-conversation-search:${encodeURIComponent(
    JSON.stringify([owner, accountId, url.href.replace(/\/$/, ""), userId]),
  )}`;
};

/** A rebuildable database. No Matrix sync or crypto store is opened here. */
export class SearchStorage {
  private db?: IDBDatabase;
  private readonly owner = crypto.randomUUID();
  private generation?: number;
  private disposed = false;
  private channel?: BroadcastChannel;
  state: "persistent" | "memory" | "other-tab" = "memory";

  constructor(
    readonly name: string,
    private readonly onRevoked: () => void,
  ) {}

  async open(): Promise<{ snapshot?: SearchSnapshot; rooms: SearchRoom[] }> {
    try {
      if (typeof BroadcastChannel !== "undefined") {
        this.channel = new BroadcastChannel(this.name);
        this.channel.onmessage = (event: MessageEvent) => {
          if (event.data === "logout") {
            this.close();
            this.onRevoked();
          }
        };
      }
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("meta");
        request.result.createObjectStore("rooms", { keyPath: "id" });
      };
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        let expired = false;
        const timer = setTimeout(() => {
          expired = true;
          reject(new Error("Search database opening timed out"));
        }, 2_000);
        request.onsuccess = () => {
          clearTimeout(timer);
          if (expired) request.result.close();
          else resolve(request.result);
        };
        request.onerror = () => {
          clearTimeout(timer);
          reject(request.error);
        };
      });
      if (this.disposed) {
        db.close();
        return { rooms: [] };
      }
      this.db = db;
      db.onversionchange = () => {
        this.close();
        this.onRevoked();
      };
      const tx = db.transaction(["meta", "rooms"], "readonly");
      const done = transactionDone(tx);
      const [snapshot, rooms] = await Promise.all([
        requestValue<StoredSnapshot | undefined>(
          tx.objectStore("meta").get("snapshot"),
        ),
        requestValue<SearchRoom[]>(tx.objectStore("rooms").getAll()),
      ]);
      await done;
      this.state = "other-tab";
      // V1 stored full checkpoints and an unused anchor. Tokens alone are
      // enough to resume the rooms, so those legacy fields are not copied.
      const compatible =
        snapshot?.format === "classic-lazy-v1" ||
        snapshot?.format === "classic-lazy-v2";
      return {
        rooms,
        snapshot: compatible
          ? {
              format: "classic-lazy-v2",
              token: snapshot.token,
              journal: snapshot.journal.map(({ oldToken, token }) => ({
                oldToken,
                token,
              })),
            }
          : undefined,
      };
    } catch {
      this.state = "memory";
      return { rooms: [] };
    }
  }

  /** Checks the lease and commits checkpoint + changed relations atomically. */
  async save(
    capture: () => {
      snapshot: SearchSnapshot;
      changed: SearchRoom[];
      removed: string[];
      allRooms: Iterable<SearchRoom>;
    },
  ): Promise<void> {
    if (!this.db || this.disposed) return;
    try {
      const tx = this.db.transaction(["meta", "rooms"], "readwrite");
      const done = transactionDone(tx);
      const meta = tx.objectStore("meta");
      let wrote = false;
      const leaseRequest: IDBRequest<Lease | undefined> = meta.get("lease");
      leaseRequest.onsuccess = () => {
        const lease = leaseRequest.result;
        const now = Date.now();
        if (
          this.disposed ||
          (lease && lease.owner !== this.owner && lease.expires > now)
        ) {
          this.state = "other-tab";
          return;
        }
        const acquired = lease?.owner !== this.owner;
        // A revoked generation never writes its outstanding response.
        if (!acquired && this.generation !== lease?.generation) return;
        this.generation = acquired
          ? (lease?.generation ?? 0) + 1
          : lease.generation;
        meta.put(
          {
            owner: this.owner,
            generation: this.generation,
            expires: now + 15_000,
          } satisfies Lease,
          "lease",
        );
        const rooms = tx.objectStore("rooms");
        // Capture and structured-clone inside this synchronous transaction
        // callback: a newer sync must not advance only half the checkpoint.
        const { snapshot, changed, removed, allRooms } = capture();
        if (acquired) rooms.clear();
        for (const room of acquired ? allRooms : changed) rooms.put(room);
        for (const id of removed) rooms.delete(id);
        meta.put(snapshot, "snapshot");
        wrote = true;
      };
      await done;
      if (wrote) this.state = "persistent";
    } catch {
      this.state = "memory";
      this.db?.close();
      this.db = undefined;
    }
  }

  close(): void {
    this.disposed = true;
    if (this.db && this.generation !== undefined) {
      try {
        const tx = this.db.transaction("meta", "readwrite");
        const meta = tx.objectStore("meta");
        const request: IDBRequest<Lease | undefined> = meta.get("lease");
        request.onsuccess = () => {
          const lease = request.result;
          if (
            lease?.owner === this.owner &&
            lease.generation === this.generation
          ) {
            meta.put({ ...lease, expires: 0 }, "lease");
          }
        };
      } catch {
        // Already closed or evicted; expiration still releases the lease.
      }
    }
    this.db?.close();
    this.db = undefined;
    this.channel?.close();
    this.channel = undefined;
  }

  async remove(): Promise<void> {
    this.close();
    await SearchStorage.remove(this.name);
  }

  static async remove(name: string): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    // Revoke before deletion, so another tab's queued transaction cannot
    // resurrect an index after logout, even when database deletion is blocked.
    const channel =
      typeof BroadcastChannel === "undefined"
        ? undefined
        : new BroadcastChannel(name);
    channel?.postMessage("logout");
    channel?.close();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }
}
