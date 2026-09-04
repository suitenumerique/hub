import type {
  MatrixConversationSearchMemberRecord,
  MatrixConversationSearchRoomRecord,
} from "./MatrixConversationSearchProjection";

/** IndexedDB version for the rebuildable search projection. */
export const MATRIX_CONVERSATION_SEARCH_SCHEMA_VERSION = 4;

// The database contains one durable search projection per room.
const ROOMS_STORE = "rooms";
const METADATA_STORE = "metadata";

/**
 * Another tab already upgraded this database to a newer schema than this code
 * knows. Deleting it would destroy that tab's freshly built index, so this
 * error must never enter a delete-and-retry recovery path; the index treats it
 * as a terminal condition for the session instead.
 */
export const isNewerSchemaVersionError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "VersionError";

class MatrixConversationSearchDatabaseBlockedError extends Error {
  /** Identify cross-tab IndexedDB contention without exposing DOM errors. */
  constructor() {
    super("Conversation search database operation is blocked.");
    this.name = "MatrixConversationSearchDatabaseBlockedError";
  }
}

/** Recognize the store's explicit cross-tab contention error. */
const isDatabaseBlockedError = (
  error: unknown,
): error is MatrixConversationSearchDatabaseBlockedError =>
  error instanceof MatrixConversationSearchDatabaseBlockedError;

type DatabaseDeletionResult =
  | "deleted"
  | "blocked"
  | "failed"
  | "unavailable";

/** Convert IndexedDB's event-based request result into an awaitable promise. */
const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/**
 * Wait for the whole transaction, not only its individual requests. A request
 * may succeed before a later failure aborts the transaction.
 */
const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });

/** Validate one untyped member value read from IndexedDB. */
const isMemberRecord = (
  value: unknown,
): value is MatrixConversationSearchMemberRecord => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const member = value as Partial<MatrixConversationSearchMemberRecord>;
  return (
    typeof member.userId === "string" && typeof member.displayName === "string"
  );
};

/** Validate a complete room projection before exposing it to the index. */
const isRoomRecord = (
  value: unknown,
): value is MatrixConversationSearchRoomRecord => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const room = value as Partial<MatrixConversationSearchRoomRecord>;
  return (
    typeof room.roomId === "string" &&
    (room.explicitName === undefined ||
      typeof room.explicitName === "string") &&
    (room.currentUserMembership === "join" ||
      room.currentUserMembership === "invite") &&
    (room.memberIndexMode === "full" || room.memberIndexMode === "name-only") &&
    Array.isArray(room.joinedMembers) &&
    room.joinedMembers.every(isMemberRecord) &&
    Array.isArray(room.invitedMembers) &&
    room.invitedMembers.every(isMemberRecord)
  );
};

/**
 * Minimal native IndexedDB persistence for the conversation-search projection.
 * It deliberately owns a separate database so an open/migration failure can
 * reset search data without touching Matrix sync or encryption stores.
 */
export class MatrixConversationSearchStore {
  /** Cached open connection. */
  private database: IDBDatabase | null = null;
  /** Shared in-flight open so concurrent callers create only one connection. */
  private openPromise: Promise<IDBDatabase> | null = null;
  /** Once disposed, asynchronous work must not reopen the database. */
  private disposed = false;

  /** Create a lazy connection wrapper for one account-scoped database name. */
  constructor(private readonly databaseName: string) {}

  /**
   * Load the validated room projection. Search data is disposable, so a read or
   * validation failure resets only this database and retries from empty.
   */
  async load(): Promise<MatrixConversationSearchRoomRecord[]> {
    try {
      return await this.loadOnce();
    } catch (error) {
      if (this.disposed) {
        throw new Error("Conversation search store is closed.");
      }
      if (isNewerSchemaVersionError(error)) {
        throw error;
      }
      // A blocked request means another tab still owns a connection. Deleting
      // the database would not fix that and could discard its valid index.
      if (isDatabaseBlockedError(error)) {
        throw error;
      }
      // Matrix sync and crypto use separate databases and are not affected.
      await this.resetDatabase();
      return this.loadOnce();
    }
  }

  /** Read every room in one transaction and reject malformed persisted data. */
  private async loadOnce(): Promise<MatrixConversationSearchRoomRecord[]> {
    const database = await this.open();
    const transaction = database.transaction(ROOMS_STORE, "readonly");
    const roomsRequest = transaction
      .objectStore(ROOMS_STORE)
      .getAll() as IDBRequest<MatrixConversationSearchRoomRecord[]>;
    const [rooms] = await Promise.all([
      requestResult(roomsRequest),
      // Do not expose request results until IndexedDB commits the transaction.
      transactionDone(transaction),
    ]);
    if (!rooms.every(isRoomRecord)) {
      throw new Error("Conversation search database data is invalid.");
    }
    return rooms;
  }

  /** Insert or replace one complete room projection transactionally. */
  async putRoom(room: MatrixConversationSearchRoomRecord): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(ROOMS_STORE, "readwrite");
    transaction.objectStore(ROOMS_STORE).put(room);
    await transactionDone(transaction);
  }

  /** Delete several room records in one read-write transaction. */
  async deleteRooms(roomIds: Iterable<string>): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(ROOMS_STORE, "readwrite");
    const rooms = transaction.objectStore(ROOMS_STORE);
    for (const roomId of roomIds) {
      rooms.delete(roomId);
    }
    await transactionDone(transaction);
  }

  /** Permanently dispose this instance and close its current connection. */
  close(): void {
    // `disposed` makes closing permanent for this client-scoped store instance.
    this.disposed = true;
    this.database?.close();
    this.database = null;
  }

  /** Wait for a pending open request, then ensure its connection is closed. */
  async whenClosed(): Promise<void> {
    // An open request cannot be synchronously cancelled. Wait for it to settle,
    // then close any connection it may have produced during teardown.
    await this.openPromise?.catch(() => undefined);
    this.database?.close();
    this.database = null;
  }

  /** Best-effort deletion used when the owning Matrix session is cleared. */
  static async deleteDatabase(databaseName: string): Promise<void> {
    await this.requestDatabaseDeletion(databaseName);
  }

  /**
   * Request deletion without waiting forever on another browser tab.
   * The result lets recovery distinguish a real deletion from a blocked one.
   */
  private static requestDatabaseDeletion(
    databaseName: string,
  ): Promise<DatabaseDeletionResult> {
    if (typeof indexedDB === "undefined") {
      return Promise.resolve("unavailable");
    }
    return new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(databaseName);
      let settled = false;
      const finish = (result: DatabaseDeletionResult) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };
      // Logout treats deletion as best effort; recovery inspects this result
      // before deciding whether it is safe to open the database again.
      request.onsuccess = () => finish("deleted");
      request.onerror = () => finish("failed");
      request.onblocked = () => {
        console.warn("Conversation search database deletion is waiting");
        // Do not make teardown or recovery wait forever for another tab.
        finish("blocked");
      };
    });
  }

  /** Reuse the current connection or the single open request already in flight. */
  private async open(): Promise<IDBDatabase> {
    if (this.disposed) {
      throw new Error("Conversation search store is closed.");
    }
    if (this.database) {
      return this.database;
    }
    // Reuse one promise while IndexedDB is opening to avoid competing upgrade
    // requests from callers such as `load()` and a live event write.
    if (!this.openPromise) {
      this.openPromise = this.openOnce().catch((error) => {
        this.openPromise = null;
        throw error;
      });
    }
    return this.openPromise;
  }

  /**
   * Open and validate the schema, rebuilding disposable records on upgrades.
   * Version changes from another tab close this connection cooperatively.
   */
  private openOnce(): Promise<IDBDatabase> {
    // Guards server rendering and browser environments without IndexedDB.
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("IndexedDB is unavailable."));
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const request = indexedDB.open(
        this.databaseName,
        MATRIX_CONVERSATION_SEARCH_SCHEMA_VERSION,
      );
      request.onupgradeneeded = () => {
        const database = request.result;
        // Field-level migrations are unnecessary: room records from an older
        // schema are cleared during the upgrade and rebuilt from Matrix by
        // startup reconciliation, without a delete-and-recreate cycle.
        if (!database.objectStoreNames.contains(ROOMS_STORE)) {
          database.createObjectStore(ROOMS_STORE, { keyPath: "roomId" });
        } else {
          request.transaction?.objectStore(ROOMS_STORE).clear();
        }
        if (database.objectStoreNames.contains(METADATA_STORE)) {
          database.deleteObjectStore(METADATA_STORE);
        }
      };
      request.onerror = () => {
        if (!settled) {
          settled = true;
          reject(request.error);
        }
      };
      request.onblocked = () => {
        if (!settled) {
          settled = true;
          reject(new MatrixConversationSearchDatabaseBlockedError());
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        // A blocked request can still complete after its promise was rejected,
        // just as an open can complete after `close()` was called.
        if (settled || this.disposed) {
          database.close();
          if (!settled) {
            settled = true;
            reject(new Error("Conversation search store is closed."));
          }
          return;
        }
        let hasValidRoomsStore = false;
        if (database.objectStoreNames.contains(ROOMS_STORE)) {
          try {
            hasValidRoomsStore =
              database
                .transaction(ROOMS_STORE, "readonly")
                .objectStore(ROOMS_STORE).keyPath === "roomId";
          } catch {
            hasValidRoomsStore = false;
          }
        }
        if (!hasValidRoomsStore) {
          database.close();
          settled = true;
          reject(new Error("Conversation search database schema is invalid."));
          return;
        }
        // Cooperate with upgrades or resets initiated by another browser tab.
        database.onversionchange = () => {
          database.close();
          if (this.database === database) {
            this.database = null;
            this.openPromise = null;
          }
        };
        this.database = database;
        settled = true;
        resolve(database);
      };
    });
  }

  /** Delete only the disposable search database before retrying from empty. */
  private async resetDatabase(): Promise<void> {
    // Clear cached handles before deleting so the retry opens a fresh
    // database rather than reusing the failed promise or connection.
    this.database?.close();
    this.database = null;
    this.openPromise = null;
    const result = await MatrixConversationSearchStore.requestDatabaseDeletion(
      this.databaseName,
    );
    if (result === "blocked") {
      // Do not queue a new open behind a deletion that another tab still blocks.
      throw new MatrixConversationSearchDatabaseBlockedError();
    }
    if (result !== "deleted") {
      throw new Error("Conversation search database could not be reset.");
    }
  }
}
