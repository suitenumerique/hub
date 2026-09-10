import { KnownMembership, type MatrixClient } from "matrix-js-sdk/lib/matrix";
import { HTTPError } from "matrix-js-sdk/lib/http-api";

import { compareChats } from "@/features/chat/chatSorting";
import { memberAcquisitions } from "@/features/chat/search/coordinator";
import {
  emptySearchRoom,
  isComplete,
  normalizeSearch,
  restoreSearchRoom,
  searchDocument,
  searchMode,
  yieldSearchWork,
  type SearchDocument,
  type SearchRoom,
} from "@/features/chat/search/model";
import {
  SearchStorage,
  type SearchCheckpoint,
  type SearchDelta,
  type SearchSnapshot,
  type SyncEdge,
} from "@/features/chat/search/storage";
import {
  EMPTY_SEARCH_STATUS,
  type ConversationSearchPage,
  type ConversationSearchRequest,
  type ConversationSearchStatus,
  type SearchPreparation,
} from "@/features/chat/search/types";

import { matrixJoinedRoomToLocalChat } from "./matrixRoomMapping";
import {
  observeMatrixSearchSync,
  projectSearchRooms,
} from "./matrixSearchSync";

/** Failures and next attempt to fetch a room's members. */
type Attempt = {
  failures: number; // Number of failures since the last reset.
  due: number; // Earliest retry time, in milliseconds since the Unix epoch.
  permanent: boolean; // Suspends automatic retries until reset.
};

/** In-flight member request and /sync changes received while it is pending. */
type Acquisition = {
  generation: number; // Service version at dispatch, used to reject stale results.
  deltas: SearchDelta[]; // Changes to replay over the /members snapshot.
  events: number; // Number of member events accumulated in these changes.
  obsolete: boolean; // Logical cancellation: the HTTP response will be ignored.
};

// Journal JSON length limit, measured in UTF-16 code units rather than bytes.
const JOURNAL_BUDGET = 2_000_000;

/**
 * Maintains search data for a single Matrix identity.
 * The sync lifecycle prepares rooms and completes their member lists;
 * search() only reads documents already built in memory.
 * Persistent storage is a rebuildable cache, separate from the SDK store.
 */
export class MatrixConversationSearch {
  // Per-room domain state: metadata, known members, and search mode.
  private readonly rooms = new Map<string, SearchRoom>();
  // Normalized room projections scanned directly by search().
  private readonly documents = new Map<string, SearchDocument>();
  // Becomes true after receiving the authoritative list of joined rooms.
  private rosterReady = false;
  // At save time, presence in rooms determines whether to write or delete.
  private readonly pendingRoomIds = new Set<string>();
  // Per-room retry history and acquisitions currently being tracked.
  private readonly attempts = new Map<string, Attempt>();
  private readonly acquisitions = new Map<string, Acquisition>();
  // Journal tokens alone establish continuity with the SDK store.
  private snapshot: SearchSnapshot = { format: "classic-lazy-v2", journal: [] };
  // Token of the last applied /sync state; also anchors the `at` parameter.
  private token?: string;
  // While catching up a continuous cache, suspend mode decisions and saves
  // until the SDK has reached the current state.
  private heldModes = false;
  // Token transitions received while suspended, used to build the next journal.
  private replay: SyncEdge[] = [];
  // Recovery requested after a break in the /sync chain.
  private needsRecovery = false;
  // Prevents concurrent recover() calls.
  private recovering = false;
  // Incremented on invalidation or closure to invalidate outstanding requests.
  private generation = 0;
  // Permanent closure flag checked by delayed operations.
  private disposed = false;
  // Cleanup functions replaced when SDK observers are installed.
  private detach = () => {};
  private detachMembers = () => {};
  // Write lease maintenance, batched notification, and deferred persistence.
  private heartbeat?: ReturnType<typeof setInterval>;
  private notifyTimer?: ReturnType<typeof setTimeout>;
  private persistTimer?: ReturnType<typeof setTimeout>;
  // Promise chain that serializes saves scheduled by persist().
  private persistenceWork: Promise<void> = Promise.resolve();
  // Internal revision used to invalidate the last cached search result.
  private revision = 0;
  // UI status: freshness, progress, and retry availability.
  private status: ConversationSearchStatus = { ...EMPTY_SEARCH_STATUS };
  private readonly storage: SearchStorage;
  // Identifies this instance in the coordinator shared across accounts.
  private readonly poolKey = crypto.randomUUID();
  // One cached search, containing all results before pagination.
  private cachedSearch?: {
    query: string;
    revision: number;
    results: SearchDocument[];
  };

  /**
   * Injects the SDK client, Hub account, and search database name.
   * changed notifies subscribers; reconcileMembership supplies joined rooms.
   * Revoking storage also closes the service that depends on it.
   * Restoration and sync observation begin in start(), not in the constructor.
   */
  constructor(
    private readonly mx: MatrixClient,
    private readonly accountId: string,
    database: string,
    private readonly changed: () => void,
    private readonly reconcileMembership: () => Promise<Set<string>>,
  ) {
    this.storage = new SearchStorage(database, () => this.close());
  }

  /**
   * Restores the cache, then observes /sync and member acquisitions.
   * Also installs storage maintenance and network event handlers.
   * Must be called before starting the Matrix client's sync loop.
   */
  async start(): Promise<void> {
    const restored = await this.storage.open();
    // The service may close while the database is opening asynchronously.
    if (this.disposed) return;
    for (const room of restored.rooms) {
      if (typeof room.id !== "string" || !room.members) continue;
      this.rooms.set(room.id, restoreSearchRoom(room));
    }
    if (restored.snapshot?.format === "classic-lazy-v2") {
      this.snapshot = restored.snapshot;
    }
    this.detach = await observeMatrixSearchSync(this.mx, {
      initial: this.initial,
      completed: this.completed,
      stale: this.stale,
      durable: (token) => {
        // The SDK confirms this durable boundary. Keeping the checkpoint that
        // reaches it and subsequent checkpoints is enough to verify continuity.
        const index = this.snapshot.journal.findIndex(
          (edge) => edge.token === token,
        );
        if (index >= 0)
          this.snapshot.journal = this.snapshot.journal.slice(index);
        this.persist();
      },
    });
    if (this.disposed) {
      this.detach();
      return;
    }
    this.observeExternalMembers();
    this.heartbeat = setInterval(() => this.persist(), 5_000);
    window.addEventListener("online", this.retry);
    window.addEventListener("offline", this.offline);
  }

  /**
   * Compares the SDK's initial state with the restored search cache token.
   * A continuous checkpoint chain allows the existing cache to catch up;
   * otherwise, member completeness evidence is rebuilt from the SDK.
   * The arrow function preserves `this` when passed to the observer.
   */
  private initial = (saved: SearchCheckpoint | null): void => {
    const previousToken = this.snapshot.token;
    let cursor = saved?.token;
    // Each oldToken -> token edge advances the continuity proof toward the cache.
    if (cursor && cursor !== previousToken) {
      for (const edge of this.snapshot.journal) {
        if (edge.oldToken === cursor) cursor = edge.token;
      }
    }
    const continuous = !!saved && !!previousToken && cursor === previousToken;
    this.heldModes = continuous;
    if (!continuous) {
      for (const room of this.rooms.values()) {
        // Keep metadata and the previous mode, but stop treating persisted
        // members as evidence of the current state.
        room.count = null;
        room.members = {};
        room.coherent = false;
        this.pendingRoomIds.add(room.id);
      }
      this.snapshot = { format: "classic-lazy-v2", journal: [] };
      if (saved) this.apply(saved);
    }
    this.token = saved?.token;
    this.refreshDocuments();
    this.publish();
  };

  /**
   * Applies the authoritative list supplied by the driver's reconciliation.
   * Removes absent rooms, creates missing states, and restarts preparation.
   */
  setJoinedRooms(ids: Set<string>): void {
    if (this.disposed) return;
    this.rosterReady = true;
    for (const id of this.rooms.keys()) {
      if (!ids.has(id)) this.removeRoom(id);
    }
    for (const id of ids) {
      if (!this.rooms.has(id)) this.rooms.set(id, emptySearchRoom(id));
    }
    this.prepareAll();
  }

  /**
   * Asks the driver for an updated joined-room list, outside the search() path.
   * The driver filters out stale responses and calls setJoinedRooms once.
   */
  async reconcile(): Promise<void> {
    try {
      await this.reconcileMembership();
    } catch {
      if (!this.disposed) this.stale();
    }
  }

  /**
   * Applies a completed /sync cycle and advances the continuity journal.
   * caughtUp means the SDK has finished catching up: room preparation can
   * start or resume, along with any pending local recovery.
   */
  private completed = (
    checkpoint: SearchCheckpoint,
    caughtUp: boolean,
  ): void => {
    if (this.disposed) return;
    // A break invalidates earlier acquisitions without discarding this cycle.
    if (checkpoint.oldToken !== this.token) this.stale(true);
    this.apply(checkpoint);
    this.token = checkpoint.token;
    const wasHeld = this.heldModes;
    const edge: SyncEdge = {
      oldToken: checkpoint.oldToken,
      token: checkpoint.token,
    };
    if (wasHeld) this.replay.push(edge);
    if (!this.heldModes || caughtUp) {
      this.heldModes = false;
      this.snapshot.token = checkpoint.token;
      if (wasHeld) {
        // When catch-up ends, replace the old journal with the replayed cycles.
        this.snapshot.journal = this.replay;
        this.replay = [];
      } else this.snapshot.journal.push(edge);
      if (JSON.stringify(this.snapshot.journal).length > JOURNAL_BUDGET) {
        // Dropping continuity evidence saves memory without removing rooms;
        // restarting may require rebuilding their state.
        this.snapshot.journal = [];
      }
    }
    const wasCurrent = this.status.freshness === "current";
    this.status.freshness = caughtUp ? "current" : "awaiting-sync";
    if (caughtUp) {
      // In steady state, prepare only the rooms affected by this cycle.
      // After catch-up or a loss of freshness, reevaluate every room.
      this.prepareAll(
        wasCurrent && !wasHeld
          ? checkpoint.rooms.map(({ id }) => id)
          : this.rooms.keys(),
      );
      if (this.needsRecovery) void this.recover();
    } else this.publish();
  };

  /**
   * Applies room departures and changes from a checkpoint to local state.
   * Also records changes received during /members so they can be replayed
   * over its response, which describes a time before the HTTP response arrives.
   */
  private apply(checkpoint: SearchCheckpoint): void {
    for (const id of checkpoint.left) this.removeRoom(id);
    for (const delta of checkpoint.rooms) {
      const room = this.rooms.get(delta.id) ?? emptySearchRoom(delta.id);
      this.applyDelta(room, delta);
      const acquisition = this.acquisitions.get(delta.id);
      if (acquisition) {
        acquisition.events += delta.members.length;
        // Beyond this limit, discard the response instead of replaying partially.
        if (acquisition.events > 10_000) acquisition.obsolete = true;
        if (!acquisition.obsolete) acquisition.deltas.push(delta);
      }
      this.rooms.set(room.id, room);
      this.pendingRoomIds.add(room.id);
    }
  }

  /**
   * Merges a change into a room without publishing or writing directly.
   * An absent field leaves its value unchanged; an explicitly null count does not.
   * Stored relationships represent only members who are currently joined.
   */
  private applyDelta(room: SearchRoom, delta: SearchDelta): void {
    if (delta.count !== undefined) room.count = delta.count;
    if (delta.name !== undefined) room.explicitName = delta.name;
    if (delta.alias !== undefined) room.alias = delta.alias;
    if (delta.invalid) {
      room.coherent = false;
      // Discard relationships when a change could not be parsed: a later valid
      // count alone would not repair their content.
      room.members = {};
    } else if (delta.count !== undefined && !room.coherent)
      room.coherent = true;
    if (room.mode === "name-only" && room.count !== null && room.count > 50) {
      // Name-only mode keeps relationships empty until the return threshold.
      room.members = {};
      return;
    }
    for (const member of delta.members) {
      if (member.joined) {
        room.members[member.id] = { name: member.name };
      } else {
        delete room.members[member.id];
      }
    }
    // Avoid retaining participants from an oversized initial state.
    if (Object.keys(room.members).length > 60) {
      room.members = {};
      room.coherent = false;
    }
  }

  /**
   * Immediately removes a room from search and schedules its deletion from storage.
   * Invalidates an in-flight /members response without cancelling its HTTP request.
   */
  private removeRoom(id: string): void {
    this.rooms.delete(id);
    this.documents.delete(id);
    this.pendingRoomIds.add(id);
    this.attempts.delete(id);
    const acquisition = this.acquisitions.get(id);
    if (acquisition) acquisition.obsolete = true;
  }

  /**
   * Prepares the specified rooms, or all joined rooms when ids is omitted.
   * Rebuilds their documents and schedules a notification and a save.
   * Any scheduled acquisitions complete independently.
   */
  private prepareAll(ids: Iterable<string> = this.rooms.keys()): void {
    if (this.disposed) return;
    for (const id of ids) {
      const room = this.rooms.get(id);
      // A delayed response must never recreate a room that has since been removed.
      if (!room) continue;
      this.prepare(room);
      const document = searchDocument(room, this.mx.getUserId()!);
      if (document) this.documents.set(id, document);
    }
    this.publish();
    if (!this.heldModes) this.persist();
  }

  /**
   * Refreshes display metadata from the SDK Room when available.
   * Then delegates the preparation decision and marks the room for persistence.
   */
  private prepare(room: SearchRoom): void {
    const sdkRoom = this.mx.getRoom(room.id);
    if (sdkRoom) {
      const chat = matrixJoinedRoomToLocalChat(
        sdkRoom,
        this.mx.getUserId() ?? undefined,
      );
      // Navigation uses the room ID. Search relationships stay in room.members,
      // without duplicating the SDK list, which may include historical members.
      chat.participantIds = [];
      if (chat.name === room.id && sdkRoom.name !== room.id)
        chat.name = sdkRoom.name;
      room.chat = chat;
    }
    this.prepareState(room);
    this.pendingRoomIds.add(room.id);
  }

  /**
   * Derives preparation from current data without storing redundant state.
   * A room is ready only when its count and members are consistent,
   * or when its size allows only name-based search.
   */
  private getPreparation(room: SearchRoom): SearchPreparation {
    if (
      this.status.freshness !== "current" ||
      !this.rosterReady ||
      this.heldModes
    )
      return "awaiting-sync";
    if (room.count === null || !this.mx.getRoom(room.id))
      return "unknown-count";
    if (
      searchMode(room.mode, room.count) === "name-only" ||
      isComplete(room, this.mx.getUserId()!)
    )
      return "complete";
    if (this.acquisitions.has(room.id)) return "loading";
    if (this.attempts.get(room.id)?.permanent) return "error";
    return "pending";
  }

  /**
   * Applies the 50/60 hysteresis rule, then completes members when needed.
   * The previous mode prevents repeated switching around a single threshold.
   */
  private prepareState(room: SearchRoom): void {
    const preparation = this.getPreparation(room);
    if (preparation === "awaiting-sync" || preparation === "unknown-count")
      return;
    room.mode = searchMode(room.mode, room.count!);
    if (room.mode === "name-only") {
      room.members = {};
      const acquisition = this.acquisitions.get(room.id);
      if (acquisition) acquisition.obsolete = true;
      this.attempts.delete(room.id);
      return;
    }
    if (preparation === "complete") {
      this.attempts.delete(room.id);
      return;
    }
    if (preparation === "pending") this.enqueue(room);
  }

  /**
   * Rebuilds documents using only rooms already in memory.
   * Does not refresh chat metadata or schedule work, unlike prepareAll().
   */
  private refreshDocuments(): void {
    for (const [id, room] of this.rooms) {
      const document = searchDocument(room, this.mx.getUserId()!);
      if (document) this.documents.set(id, document);
    }
  }

  /**
   * Queues an acquisition when network conditions and service state allow it.
   * The shared coordinator deduplicates jobs, honors due, and limits concurrency
   * to four, considering accounts, room activity, and time spent in the queue.
   */
  private enqueue(room: SearchRoom): void {
    const attempt = this.attempts.get(room.id);
    if (
      attempt?.permanent ||
      !navigator.onLine ||
      this.status.freshness !== "current"
    )
      return;
    memberAcquisitions.enqueue({
      key: `${this.poolKey}:${room.id}`,
      account: this.poolKey,
      activity: room.chat?.lastActivityAt
        ? Date.parse(room.chat.lastActivityAt)
        : 0,
      due: attempt?.due ?? 0,
      run: () => this.acquire(room.id),
    });
  }

  /**
   * Fetches joined members at the current /sync boundary and validates the snapshot.
   * On a relevant failure, records a retry time or suspends automatic retries.
   * Reevaluates the room afterward, whether the request succeeds or fails.
   */
  private async acquire(id: string): Promise<void> {
    const room = this.rooms.get(id);
    // The job may have waited in the queue: recheck every condition at dispatch.
    if (
      this.disposed ||
      !room ||
      !this.token ||
      this.status.freshness !== "current" ||
      !navigator.onLine ||
      room.mode !== "participants" ||
      room.count === null ||
      room.count > 60 ||
      this.acquisitions.has(id) ||
      isComplete(room, this.mx.getUserId()!)
    )
      return;
    const acquisition: Acquisition = {
      generation: this.generation,
      deltas: [],
      events: 0,
      obsolete: false,
    };
    this.acquisitions.set(id, acquisition);
    this.publish();
    try {
      // `at` anchors the snapshot. acceptSnapshot() replays /sync changes received
      // while waiting to bring the members up to the current local state.
      const response = await this.mx.members(
        id,
        KnownMembership.Join,
        undefined,
        this.token,
      );
      if (!this.canPublish(id, acquisition)) return;
      this.acceptSnapshot(id, response, acquisition);
      this.attempts.delete(id);
    } catch (error) {
      if (!this.canPublish(id, acquisition)) return;
      const failures = (this.attempts.get(id)?.failures ?? 0) + 1;
      const status = error instanceof HTTPError ? error.httpStatus : undefined;
      let retryAfter = 0;
      if (error instanceof HTTPError) {
        try {
          const delay = error.getRetryAfterMs();
          if (delay !== null && Number.isFinite(delay))
            retryAfter = Math.max(0, delay);
        } catch {
          // A malformed server hint falls back to the exponential delay.
        }
      }
      // Client errors other than rate limits, and the sixth failure, stop
      // automatic retries; retry() can reset that decision.
      const permanent =
        (status !== undefined &&
          status >= 400 &&
          status < 500 &&
          !(error instanceof HTTPError && error.isRateLimitError())) ||
        failures >= 6;
      // Use the longer delay: the server hint or exponential backoff with
      // +/-20% jitter. The 60-second cap applies before jitter.
      this.attempts.set(id, {
        failures,
        permanent,
        due:
          Date.now() +
          Math.max(
            retryAfter,
            Math.min(60_000, 1_000 * 2 ** failures) *
              (0.8 + Math.random() * 0.4),
          ),
      });
      if (status === 403 || status === 404) void this.reconcile();
    } finally {
      this.acquisitions.delete(id);
      if (!this.disposed) {
        // The coordinator releases its slot after run() resolves. Deferring
        // preparation prevents its deduplication from swallowing the retry.
        setTimeout(() => {
          if (!this.disposed) this.prepareAll([id]);
        }, 0);
      }
    }
  }

  /**
   * Validates /members event structure and uniqueness, then builds a candidate.
   * Replays accumulated /sync deltas before checking final completeness.
   * Replaces the room only when every check passes.
   */
  private acceptSnapshot(
    id: string,
    response: unknown,
    acquisition: Acquisition,
  ): void {
    const chunk: unknown = (response as { chunk?: unknown })?.chunk;
    if (
      !Array.isArray(chunk) ||
      chunk.some(
        (event) =>
          !event ||
          event.type !== "m.room.member" ||
          (event.room_id && event.room_id !== id),
      )
    )
      throw new Error("Invalid members snapshot");
    // Reuse the /sync parser by wrapping these events in the same structure.
    const delta = projectSearchRooms({
      join: { [id]: { state: { events: chunk } } },
    }).rooms[0];
    if (
      delta.invalid ||
      new Set(delta.members.map((member) => member.id)).size !==
        delta.members.length
    ) {
      throw new Error("Invalid joined members snapshot");
    }
    const current = this.rooms.get(id)!;
    // Keep current metadata, but replace member relationships. Working on a copy
    // preserves the published room if the candidate turns out to be incomplete.
    const candidate: SearchRoom = { ...current, members: {}, coherent: true };
    this.applyDelta(candidate, delta);
    for (const following of acquisition.deltas)
      this.applyDelta(candidate, following);
    if (!isComplete(candidate, this.mx.getUserId()!))
      throw new Error("Incomplete members snapshot");
    this.rooms.set(id, candidate);
  }

  /**
   * Wraps mx.members to reuse compatible requests made by the SDK or another
   * consumer. Preserves the original result, errors, and `this` binding.
   * detachMembers restores the original method when the service closes.
   */
  private observeExternalMembers(): void {
    const original = this.mx.members;
    this.mx.members = async (...args) => {
      const [id, include, exclude, at] = args;
      const room = this.rooms.get(id);
      // Reuse only requests at the same `at` boundary with compatible filters.
      // The SDK's OOB flags do not establish this equivalence.
      const track =
        !this.disposed &&
        !this.acquisitions.has(id) &&
        room?.mode === "participants" &&
        at === this.token &&
        !!at &&
        this.status.freshness === "current" &&
        (!include || include === KnownMembership.Join) &&
        (!exclude || exclude === KnownMembership.Leave);
      const acquisition: Acquisition = {
        generation: this.generation,
        deltas: [],
        events: 0,
        obsolete: false,
      };
      if (track) this.acquisitions.set(id, acquisition);
      try {
        const result = await original.apply(this.mx, args);
        if (track && this.canPublish(id, acquisition)) {
          try {
            this.acceptSnapshot(id, result, acquisition);
          } catch {
            // A search-specific rejection must not hide the caller's response.
          }
        }
        return result;
      } finally {
        if (track) {
          this.acquisitions.delete(id);
          if (!this.disposed) this.prepareAll([id]);
        }
      }
    };
    this.detachMembers = () => {
      this.mx.members = original;
    };
  }

  /**
   * Accepts or rejects an asynchronous response based on current service state.
   * Generation guards global invalidations; obsolete guards local cancellation.
   * These checks discard stale responses without interrupting HTTP requests.
   */
  private canPublish(id: string, acquisition: Acquisition): boolean {
    const room = this.rooms.get(id);
    return (
      !this.disposed &&
      !acquisition.obsolete &&
      acquisition.generation === this.generation &&
      this.status.freshness === "current" &&
      room?.mode === "participants" &&
      room.count !== null &&
      room.count <= 60
    );
  }

  /**
   * Marks the state as stale and removes acquisitions still waiting in the queue.
   * With invalidate, also discards continuity evidence and known members,
   * then requests recovery once synchronization is current again.
   */
  private stale = (invalidate = false): void => {
    if (this.disposed) return;
    this.status.freshness = "stale";
    memberAcquisitions.cancel(this.poolKey);
    if (invalidate) {
      this.generation++;
      this.needsRecovery = true;
      this.snapshot.journal = [];
      this.snapshot.token = undefined;
      for (const room of this.rooms.values()) {
        room.coherent = false;
        room.count = null;
        room.members = {};
        this.pendingRoomIds.add(room.id);
      }
      this.refreshDocuments();
    }
    this.publish();
  };

  /** Goes offline while preserving local data that can still be searched. */
  private offline = (): void => this.stale();

  /**
   * Rebuilds state from the SDK store snapshot after invalidation.
   * Applies it only if it still matches the latest completed /sync cycle.
   * Runs one recovery at a time; an unsuccessful recovery remains pending.
   */
  private async recover(): Promise<void> {
    if (this.recovering || this.disposed) return;
    this.recovering = true;
    try {
      // Here, getSavedSync provides the snapshot accumulated in the SDK's memory;
      // it does not confirm that this state has been written to disk.
      const saved = await this.mx.store.getSavedSync();
      if (
        !saved ||
        this.disposed ||
        saved.nextBatch !== this.token ||
        this.status.freshness !== "current"
      )
        return;
      this.apply({
        token: saved.nextBatch,
        ...projectSearchRooms(saved.roomsData),
      });
      this.needsRecovery = false;
      this.prepareAll();
    } catch {
      this.stale();
    } finally {
      this.recovering = false;
    }
  }

  /**
   * Retries connection and preparation on request or when the network returns.
   * Reactivates suspended attempts without bringing forward a future deadline.
   * Synchronization and reconciliation continue asynchronously.
   */
  retry = (): void => {
    if (this.disposed) return;
    memberAcquisitions.cancel(this.poolKey);
    const now = Date.now();
    for (const [id, attempt] of this.attempts) {
      if (attempt.due <= now) this.attempts.delete(id);
      else this.attempts.set(id, { ...attempt, failures: 0, permanent: false });
    }
    // This action can restart network work; search() never takes this path.
    this.mx.retryImmediately();
    void this.reconcile();
    this.prepareAll();
  };

  /** Returns the current status without calculation, copying, or storage access. */
  getStatus = (): ConversationSearchStatus => this.status;

  /**
   * Immediately invalidates the search cache and increments its revision.
   * Then batches counter updates and UI notifications within an 80 ms window
   * to absorb changes that arrive close together.
   */
  private publish(): void {
    if (this.disposed) return;
    this.revision++;
    this.cachedSearch = undefined;
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = undefined;
      if (this.disposed) return;
      const status: ConversationSearchStatus = {
        ...EMPTY_SEARCH_STATUS,
        freshness: this.status.freshness,
        storageAvailable: this.storage.state !== "memory",
        hasUnknownRooms: !this.rosterReady || this.heldModes,
      };
      for (const room of this.rooms.values()) {
        const preparation = this.getPreparation(room);
        if (room.mode === "name-only") status.hasNameOnlyRooms = true;
        if (room.mode === "participants") {
          status.eligible++;
          if (preparation === "complete") status.ready++;
        }
        if (preparation === "awaiting-sync" || preparation === "unknown-count")
          status.hasUnknownRooms = true;
        if (preparation === "error") status.hasFailures = true;
        if (preparation === "pending" && this.attempts.has(room.id))
          status.hasDeferredRooms = true;
      }
      this.status = status;
      this.changed();
    }, 80);
  }

  /**
   * Batches requests over 250 ms, then serializes scheduled writes.
   * Storage invokes the capture callback only when it can actually write;
   * pending IDs remain untouched while another tab holds the lease.
   */
  private persist(): void {
    if (this.disposed || this.heldModes || this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = undefined;
      this.persistenceWork = this.persistenceWork.then(async () => {
        if (this.disposed || this.heldModes) return;
        const state = this.storage.state;
        await this.storage.save(() => {
          // Capture state when writing, rather than when the save was scheduled.
          const changed: SearchRoom[] = [];
          const removed: string[] = [];
          for (const id of this.pendingRoomIds) {
            const room = this.rooms.get(id);
            if (room) changed.push(room);
            else removed.push(id);
          }
          this.pendingRoomIds.clear();
          return {
            snapshot: this.snapshot,
            changed,
            removed,
            allRooms: this.rooms.values(), // Full rebuild when acquiring the lease.
          };
        });
        if (state !== this.storage.state) this.publish();
      });
    }, 250);
  }

  /**
   * Searches in-memory documents without IndexedDB, Matrix API calls, or setup.
   * Reuses the last search when its revision is unchanged.
   * The scan periodically yields to the browser and respects cancellation.
   * Sorts all matching results before applying pagination.
   */
  async search(
    request: ConversationSearchRequest,
  ): Promise<ConversationSearchPage> {
    const query = normalizeSearch(request.query);
    const revision = this.revision;
    let results =
      this.cachedSearch?.query === query &&
      this.cachedSearch.revision === revision
        ? this.cachedSearch.results
        : undefined;
    if (!results) {
      results = [];
      // Freeze the list to scan; this array does not deeply copy its objects.
      const documents = [...this.documents.values()];
      let sliceStart = performance.now();
      for (const document of documents) {
        request.signal?.throwIfAborted();
        if (query && document.fields.some((field) => field.includes(query)))
          results.push(document);
        // Scan for roughly 6 ms per slice, then yield to the browser's event loop.
        if (performance.now() - sliceStart >= 6) {
          await yieldSearchWork();
          sliceStart = performance.now();
        }
      }
      // Adapt local chats to the shared comparator: activity, name, account, and ID.
      results.sort((a, b) =>
        compareChats(
          {
            ...a.chat,
            accountId: this.accountId,
            ref: { accountId: this.accountId, chatId: a.chat.id },
          },
          {
            ...b.chat,
            accountId: this.accountId,
            ref: { accountId: this.accountId, chatId: b.chat.id },
          },
        ),
      );
      // A publication during a yield prevents caching this calculation.
      if (revision === this.revision)
        this.cachedSearch = { query, revision, results };
    }
    request.signal?.throwIfAborted();
    const limit = Math.max(1, request.limit ?? 40);
    return {
      results: results
        .slice(0, limit)
        .map(({ chat, subtitle }) => ({ chat, subtitle })),
      total: results.length,
    };
  }

  /**
   * Permanently closes the instance: invalidates responses, removes observers,
   * cancels timers, and clears documents. Repeated close() calls have no effect.
   * Attempts a final save outside catch-up without waiting for it before returning.
   */
  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    memberAcquisitions.cancel(this.poolKey);
    this.detach();
    this.detachMembers();
    clearInterval(this.heartbeat);
    clearTimeout(this.notifyTimer);
    clearTimeout(this.persistTimer);
    window.removeEventListener("online", this.retry);
    window.removeEventListener("offline", this.offline);
    // Capture rooms before clearing the Maps, then release the lease after saving.
    // remove() takes a different path: immediate storage closure and deletion.
    const rooms = [...this.rooms.values()];
    const snapshot = this.snapshot;
    const removed = [...this.pendingRoomIds].filter(
      (id) => !this.rooms.has(id),
    );
    if (!this.heldModes) {
      void this.storage
        .save(() => ({ snapshot, changed: rooms, removed, allRooms: rooms }))
        .finally(() => this.storage.close());
    } else this.storage.close();
    this.rooms.clear();
    this.documents.clear();
    this.status = { ...EMPTY_SEARCH_STATUS, storageAvailable: false };
    this.changed();
  }

  /**
   * Stops the service, then requests deletion of its search database.
   * SearchStorage also broadcasts the deletion to other affected tabs.
   */
  async remove(): Promise<void> {
    this.close();
    await this.storage.remove();
  }
}
