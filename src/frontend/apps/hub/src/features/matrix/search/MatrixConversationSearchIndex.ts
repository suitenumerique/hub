import {
  KnownMembership,
  MatrixError,
  type MatrixClient,
  type Room,
  type RoomMember,
} from "matrix-js-sdk/lib/matrix";

import {
  compareChatSearchText,
  normalizeChatSearchText,
} from "@/features/chat/chatSearchMatching";
import type { ChatSearchIndexStatus } from "@/features/drivers/Driver";
import type { LocalChatSearchResult } from "@/features/drivers/types";

import {
  isNewerSchemaVersionError,
  MatrixConversationSearchStore,
} from "./MatrixConversationSearchStore";
import { hydrateRoom } from "./MatrixConversationSearchHydrator";
import {
  applyMember,
  applyRoomName,
  matchRoomRecord,
  mergeCurrentSdkState,
  sameRoomRecord,
  shouldIndexMembers,
  sortMemberRecords,
  type MatrixConversationSearchRoomRecord,
} from "./MatrixConversationSearchProjection";
import { KeyedRoomQueue } from "./KeyedRoomQueue";

// Bound background work so large accounts do not flood the homeserver or block
// the main thread with too many simultaneous room updates.
const INDEXING_CONCURRENCY = 4;
const STATUS_THROTTLE_MS = 1000;

type StatusListener = (
  status: ChatSearchIndexStatus,
  resultsChanged: boolean,
) => void;

type MatrixConversationSearchIndexOptions = {
  client: MatrixClient;
  databaseName: string;
  /** Authoritative `/joined_rooms` projection supplied by MatrixDriver. */
  getJoinedRoomIds: () => Promise<Set<string>>;
  /** Bridge to driver events and React Query invalidation. */
  onStatusChanged: StatusListener;
};

/** Log error categories without leaking room, member, or server-response data. */
const nonSensitiveErrorKind = (error: unknown): string => {
  if (error instanceof MatrixError) {
    return `MatrixError:${error.httpStatus ?? "unknown"}:${error.errcode ?? "unknown"}`;
  }
  if (error instanceof DOMException) {
    return `DOMException:${error.name}`;
  }
  return error instanceof Error ? error.name : typeof error;
};

/** Yield between large reconciliation batches so the browser can repaint. */
const yieldToBrowser = (): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

/**
 * Session-local search projection backed by one account-scoped IndexedDB.
 * Search reads only the in-memory map; Matrix requests are confined to the
 * bounded background queue and never run from a keystroke.
 *
 * Multiple tabs may duplicate `/members` work and the last durable write wins.
 * Each room write remains transactional; reconciliation repairs stale cache.
 *
 * Asynchronous methods capture `generation` before their first `await` and
 * check it again after asynchronous boundaries. `stop()` increments generation,
 * so work belonging to an old Matrix client becomes a no-op when it resumes.
 * These guards do not cancel requests or roll back committed IndexedDB writes;
 * they prevent stale continuations from mutating memory or notifying the UI.
 */
export class MatrixConversationSearchIndex {
  // Injected boundaries: Matrix state, durable storage, authoritative joined
  // membership, and the notification bridge back to MatrixDriver.
  private readonly client: MatrixClient;
  private readonly store: MatrixConversationSearchStore;
  private readonly getJoinedRoomIds: () => Promise<Set<string>>;
  private readonly onStatusChanged: StatusListener;
  private readonly roomQueue: KeyedRoomQueue;

  // Searchable in-memory projection and the room-id sets used to validate it.
  private records = new Map<string, MatrixConversationSearchRoomRecord>();
  /** Authoritative joined ids from `/joined_rooms`. */
  private joinedRoomIds = new Set<string>();
  /** Incoming invitation ids from visible Matrix SDK rooms. */
  private invitedRoomIds = new Set<string>();

  // Background hydration queue and failure tracking.
  private failedRoomIds = new Set<string>();
  /** Name-only rooms already given their one promotion attempt this session. */
  private promotionAttemptedRoomIds = new Set<string>();

  // Revisions invalidate network snapshots; persistence remains globally
  // ordered so a later leave cannot be overtaken by an older room write.
  private roomRevisions = new Map<string, number>();
  private persistenceQueue: Promise<void> = Promise.resolve();
  /** Events received before the initial authoritative snapshot is available. */
  private dirtyRoomIds = new Set<string>();

  // Lifecycle and observable status state.
  /**
   * Set when another tab upgraded the database past this code's schema.
   * Hydration must stop instead of retrying `/members` sweeps whose writes can
   * never commit with this client version.
   * Already-loaded records stay searchable; a page reload recovers.
   */
  private storeBroken = false;
  /** Incremented on stop so stale async work can finish without taking effect. */
  private generation = 0;
  private started = false;
  private loaded = false;
  private hasJoinedSnapshot = false;
  private stopped = false;
  private reconcilePromise: Promise<void> | null = null;
  private reconcileRequested = false;
  private statusTimer: number | null = null;
  private pendingResultsChanged = false;
  private status: ChatSearchIndexStatus = {
    phase: "loading",
    indexedRooms: 0,
    totalRooms: 0,
    failedRooms: 0,
  };

  /**
   * Wire the Matrix sources, durable store, and bounded room worker queue.
   * Construction is side-effect free; {@link start} performs the first load.
   */
  constructor(options: MatrixConversationSearchIndexOptions) {
    this.client = options.client;
    this.store = new MatrixConversationSearchStore(options.databaseName);
    this.getJoinedRoomIds = options.getJoinedRoomIds;
    this.onStatusChanged = options.onStatusChanged;
    this.roomQueue = new KeyedRoomQueue({
      concurrency: INDEXING_CONCURRENCY,
      worker: (roomId) => this.indexRoom(roomId, this.generation),
      onIdle: () => {
        if (!this.stopped && !this.storeBroken) {
          this.setPhase(this.failedRoomIds.size > 0 ? "error" : "ready", true);
        }
      },
    });
  }

  /** Return a snapshot of progress without exposing mutable internal state. */
  getStatus(): ChatSearchIndexStatus {
    // Never expose the mutable internal status object to callers.
    return { ...this.status };
  }

  /**
   * Restore persisted room projections, then reconcile them with Matrix.
   * Existing results are loaded first so they remain available while missing
   * or stale rooms are hydrated in the background.
   */
  async start(): Promise<void> {
    // A stopped index belongs to an old Matrix client and is never restarted.
    if (this.started || this.stopped) {
      return;
    }
    this.started = true;
    const generation = this.generation;
    try {
      const records = await this.store.load();
      // `stop()` may have run while IndexedDB was opening.
      if (!this.isCurrent(generation)) {
        return;
      }
      records.forEach((record) => {
        this.records.set(record.roomId, {
          ...record,
          joinedMembers: sortMemberRecords(record.joinedMembers),
          invitedMembers: sortMemberRecords(record.invitedMembers),
        });
      });
      this.loaded = true;
      const reconciliation = this.reconcileInternal(generation);
      this.reconcilePromise = reconciliation;
      try {
        await reconciliation;
      } finally {
        if (this.reconcilePromise === reconciliation) {
          this.reconcilePromise = null;
        }
      }
      this.replayRequestedReconciliation();
    } catch (error) {
      // Ignore failures reported after teardown: this old index must not publish
      // an error state into the replacement client's UI.
      if (this.isCurrent(generation)) {
        if (isNewerSchemaVersionError(error)) {
          this.markStoreBroken();
        }
        console.warn(
          "Matrix conversation search failed to start",
          nonSensitiveErrorKind(error),
        );
        this.setPhase("error", true);
      }
    }
  }

  /**
   * Stop accepting work, invalidate asynchronous results, and close the store.
   * In-flight network requests may finish but can no longer mutate state.
   */
  stop(): void {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    // In-flight promises are not cancelled, but their generation checks fail.
    this.generation += 1;
    this.roomQueue.stop();
    this.dirtyRoomIds.clear();
    this.reconcileRequested = false;
    if (this.statusTimer !== null) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.store.close();
  }

  /** Wait for already-started persistence and IndexedDB opening to settle. */
  async whenStopped(): Promise<void> {
    // Wait only for persistence already in flight. Network hydration can be
    // slow or unbounded; generation guards make its eventual result a no-op.
    await this.persistenceQueue.catch(() => undefined);
    await this.store.whenClosed();
  }

  /**
   * Match only the in-memory projection. This method must never perform Matrix
   * or IndexedDB I/O because it runs for every search-input update.
   */
  search(value: string): LocalChatSearchResult[] {
    const query = normalizeChatSearchText(value);
    const currentUserId = this.client.getUserId() ?? undefined;
    if (!query || !currentUserId) {
      return [];
    }

    return [...this.records.values()]
      .flatMap((record): LocalChatSearchResult[] => {
        // Persisted data is usable only while it still agrees with the current
        // joined/invited sets and has a live SDK room for mapping/navigation.
        if (!this.isRecordCurrent(record)) {
          return [];
        }
        const room = this.client.getRoom(record.roomId);
        if (!room) {
          return [];
        }
        const result = matchRoomRecord(record, room, currentUserId, query);
        return result ? [result] : [];
      })
      .sort(
        // Section ordering is handled by the modal; the index keeps ranking
        // stable within the merged account-local result set.
        (left, right) =>
          left.matchRank - right.matchRank ||
          compareChatSearchText(left.chat.name, right.chat.name) ||
          left.chat.id.localeCompare(right.chat.id),
      );
  }

  /**
   * Request reconciliation after a real `/sync` or reconnect.
   * Concurrent requests are coalesced into one additional pass.
   */
  reconcile(): void {
    // Coalesce sync/reconnect triggers while one reconciliation is in flight.
    // A broken store cannot persist anything, so a sweep would only replay
    // failing writes and their `/members` requests.
    if (this.stopped || !this.started || this.storeBroken) {
      return;
    }
    if (this.reconcilePromise) {
      this.reconcileRequested = true;
      return;
    }
    const generation = this.generation;
    this.setPhase("catching-up");
    this.reconcilePromise = this.reconcileInternal(generation)
      .catch((error) => {
        // A rejected reconciliation from an old generation is irrelevant after
        // stop/account switch and must not replace the new index's status.
        if (this.isCurrent(generation)) {
          if (isNewerSchemaVersionError(error)) {
            this.markStoreBroken();
          }
          this.setPhase("error", true);
        }
      })
      .finally(() => {
        // Only the generation which installed this promise may clear it or
        // replay a coalesced reconciliation request.
        if (this.isCurrent(generation)) {
          this.reconcilePromise = null;
          this.replayRequestedReconciliation();
        }
      });
  }

  /**
   * Retry failed startup or reconciliation when search is opened again.
   * A healthy index is untouched, so opening search does not reindex it.
   */
  resume(): void {
    // Reopening search retries only a previously failed index; a broken store
    // stays terminal for the session.
    if (this.stopped || !this.started || this.storeBroken) {
      return;
    }
    if (this.status.phase !== "error") {
      return;
    }
    this.failedRoomIds.clear();
    // A user-triggered retry also re-opens the one promotion attempt so a
    // failed promotion is not latched for the whole session.
    this.promotionAttemptedRoomIds.clear();
    if (!this.loaded) {
      // A transient startup/open failure must retry the load itself; reconciling
      // alone would leave live handlers permanently waiting for `loaded`.
      this.started = false;
      this.setPhase("loading", true);
      void this.start();
      return;
    }
    this.reconcile();
  }

  /**
   * Apply one live membership/profile event for another user.
   * Before startup completes, mark the room dirty for later hydration.
   */
  handleMember(member: RoomMember): void {
    // Current-user membership has different room-lifecycle semantics and is
    // handled by `handleMyMembership` instead.
    if (this.stopped || member.userId === this.client.getUserId()) {
      return;
    }
    const roomId = member.roomId;
    // Invalidates a `/members` snapshot that may currently be in flight.
    this.bumpRoomRevision(roomId);
    if (!this.loaded || !this.hasJoinedSnapshot) {
      // Reconciliation will hydrate the final state once sources are ready.
      this.dirtyRoomIds.add(roomId);
      return;
    }
    void this.roomQueue
      .serialize(roomId, async () => {
        const current = this.records.get(roomId);
        if (!current || !this.hasCurrentRoom(roomId)) {
          // A current room without a record needs full background hydration.
          if (this.hasCurrentRoom(roomId)) {
            this.enqueueRoom(roomId);
          }
          return;
        }
        const next = applyMember(current, member);
        // Avoid a durable write when an SDK event repeats the current state.
        if (!sameRoomRecord(current, next)) {
          await this.persistRoom(next, true);
        }
      })
      .catch((error) => this.handlePersistenceError(error));
  }

  /** Apply a live explicit room-name change without reloading all members. */
  handleName(room: Room): void {
    if (this.stopped) {
      return;
    }
    const roomId = room.roomId;
    // A concurrent full-room hydration must not overwrite this newer name.
    this.bumpRoomRevision(roomId);
    if (!this.loaded || !this.hasJoinedSnapshot) {
      this.dirtyRoomIds.add(roomId);
      return;
    }
    void this.roomQueue
      .serialize(roomId, async () => {
        const current = this.records.get(roomId);
        if (!current || !this.hasCurrentRoom(roomId)) {
          if (this.hasCurrentRoom(roomId)) {
            this.enqueueRoom(roomId);
          }
          return;
        }
        const next = applyRoomName(current, room);
        if (!sameRoomRecord(current, next)) {
          await this.persistRoom(next, true);
        }
      })
      .catch((error) => this.handlePersistenceError(error));
  }

  /**
   * Apply the current user's room-membership transition.
   * Join/invite schedules hydration; leave/reject/ban removes the whole record.
   */
  handleMyMembership(room: Room, membership: RoomMember["membership"]): void {
    if (this.stopped) {
      return;
    }
    const roomId = room.roomId;
    this.bumpRoomRevision(roomId);
    // Leave, reject, ban, and forget all remove the room from search. The
    // durable deletion is serialized with other IndexedDB mutations.
    if (
      membership !== KnownMembership.Join &&
      membership !== KnownMembership.Invite
    ) {
      this.joinedRoomIds.delete(roomId);
      this.invitedRoomIds.delete(roomId);
      this.failedRoomIds.delete(roomId);
      this.roomQueue.removePending(roomId);
      void this.removeRoomRecords([roomId], true).catch((error) =>
        this.handlePersistenceError(error),
      );
      return;
    }
    // Moving between join and invite invalidates the old record until a new
    // membership-consistent snapshot is hydrated.
    if (membership === KnownMembership.Join) {
      this.invitedRoomIds.delete(roomId);
      this.joinedRoomIds.add(roomId);
    } else {
      this.joinedRoomIds.delete(roomId);
      this.invitedRoomIds.add(roomId);
    }
    if (!this.loaded || !this.hasJoinedSnapshot) {
      this.dirtyRoomIds.add(roomId);
      return;
    }
    this.enqueueRoom(roomId);
  }

  /** Normalize a newly visible SDK room through the membership lifecycle. */
  handleRoom(room: Room): void {
    // Room visibility events are normalized through the membership handler so
    // they follow the same queueing and removal rules as explicit transitions.
    const membership = room.getMyMembership();
    if (
      membership === KnownMembership.Join ||
      membership === KnownMembership.Invite
    ) {
      this.handleMyMembership(room, membership);
    }
  }

  /**
   * Converge the durable projection toward the current Matrix state.
   *
   * The pass deliberately follows this order:
   * 1. read authoritative joined room ids and synced incoming invitations;
   * 2. delete records for rooms no longer visible to the current user;
   * 3. merge available SDK state into existing records without network I/O;
   * 4. queue only missing, membership-stale, or promotable rooms;
   * 5. replay rooms dirtied by live events received during startup.
   *
   * Deleting first prevents stale rooms from remaining searchable while the
   * bounded background hydration queue catches up.
   */
  private async reconcileInternal(generation: number): Promise<void> {
    let joinedRoomIds: Set<string>;
    try {
      // `/joined_rooms` is authoritative even when SDK room membership lags
      // immediately after a join or leave transition.
      joinedRoomIds = await this.getJoinedRoomIds();
    } catch {
      // The request can fail after this index has already been stopped. In that
      // case, leave the obsolete instance untouched instead of publishing error.
      if (!this.isCurrent(generation)) {
        return;
      }
      if (this.joinedRoomIds.size === 0 && this.records.size > 0) {
        // Preserve the last durable projection while offline. The next real
        // sync reconciliation restores the authoritative joined-room set.
        this.joinedRoomIds = new Set(
          [...this.records.values()]
            .filter(
              (record) => record.currentUserMembership === KnownMembership.Join,
            )
            .map((record) => record.roomId),
        );
        this.invitedRoomIds = new Set(
          [...this.records.values()]
            .filter(
              (record) =>
                record.currentUserMembership === KnownMembership.Invite,
            )
            .map((record) => record.roomId),
        );
      }
      this.setPhase("error", true);
      return;
    }
    // `/joined_rooms` may have resolved after stop/account switch. Do not apply
    // that old account snapshot to this now-obsolete in-memory index.
    if (!this.isCurrent(generation)) {
      return;
    }

    this.joinedRoomIds = joinedRoomIds;
    // Incoming invitations are absent from `/joined_rooms`; the synced SDK
    // room list is the available source for them.
    this.invitedRoomIds = this.currentInvitedRoomIds();
    this.hasJoinedSnapshot = true;
    const currentRoomIds = this.currentRoomIds();
    // Remove left rooms and cancelled/rejected invitations before hydrating new
    // work. Every durable record loaded by the v4 Store is in `records`.
    const removedRoomIds = [...this.records.keys()].filter(
      (roomId) => !currentRoomIds.has(roomId),
    );
    if (removedRoomIds.length > 0) {
      await this.removeRoomRecords(removedRoomIds, true);
    }
    // Deletion may already be committed, but teardown during the transaction
    // means the old reconciliation must not continue with merge/hydration work.
    if (!this.isCurrent(generation)) {
      return;
    }

    let inspected = 0;
    // Refresh durable records with state already present in the SDK. This path
    // avoids a network request and preserves complete persisted members when a
    // joined room has only a partial SDK member snapshot.
    for (const [roomId] of this.records) {
      if (!currentRoomIds.has(roomId)) {
        continue;
      }
      await this.roomQueue.serialize(roomId, async () => {
        const current = this.records.get(roomId);
        const room = this.client.getRoom(roomId);
        if (!current || !room) {
          return;
        }
        const refreshed = mergeCurrentSdkState(
          current,
          room,
          this.client.getUserId(),
        );
        if (!sameRoomRecord(current, refreshed)) {
          await this.persistRoom(refreshed, true);
        }
      });
      inspected += 1;
      if (inspected % 100 === 0) {
        // Large accounts should not monopolize the browser main thread.
        await yieldToBrowser();
      }
      // Even a zero-delay browser yield gives stop() an opportunity to advance
      // generation, so recheck before inspecting the next room.
      if (!this.isCurrent(generation)) {
        return;
      }
    }

    // Missing or membership-stale records need full hydration.
    const pendingRoomIds = [...currentRoomIds].filter((roomId) => {
      const record = this.records.get(roomId);
      if (!record || !this.isRecordCurrent(record)) {
        return true;
      }
      // A name-only room whose membership shrank back under the cap is
      // promoted through full hydration; partial SDK merges cannot rebuild
      // its member list.
      if (record.memberIndexMode !== "name-only") {
        return false;
      }
      // The joined count can be under-reported while the sync summary is
      // absent, and a failed promotion would then repeat its full hydration
      // on every reconcile. One attempt per session bounds that churn.
      if (this.promotionAttemptedRoomIds.has(roomId)) {
        return false;
      }
      const room = this.client.getRoom(roomId);
      if (!room || !shouldIndexMembers(room)) {
        return false;
      }
      this.promotionAttemptedRoomIds.add(roomId);
      return true;
    });
    this.dirtyRoomIds.forEach((roomId) => {
      // Events captured during startup get one final authoritative pass.
      if (currentRoomIds.has(roomId)) {
        pendingRoomIds.push(roomId);
      }
    });
    this.dirtyRoomIds.clear();
    this.failedRoomIds.clear();

    if (pendingRoomIds.length === 0) {
      this.setPhase("ready", true);
      return;
    }
    // Persisted results remain usable during catch-up; a brand-new projection
    // uses the more explicit initial indexing phase.
    this.setPhase(this.records.size > 0 ? "catching-up" : "indexing", true);
    new Set(pendingRoomIds).forEach((roomId) => this.enqueueRoom(roomId));
  }

  /** Queue one current room once, subject to lifecycle and store guards. */
  private enqueueRoom(roomId: string): void {
    if (
      this.stopped ||
      !this.started ||
      this.storeBroken ||
      !this.hasCurrentRoom(roomId)
    ) {
      return;
    }
    this.failedRoomIds.delete(roomId);
    this.roomQueue.enqueue(roomId);
  }

  /**
   * Hydrate and persist one room selected by the bounded worker queue.
   * A per-room revision rejects a `/members` snapshot when a newer live event
   * was observed during the request, then queues a fresh attempt.
   */
  private async indexRoom(roomId: string, generation: number): Promise<void> {
    try {
      // A queued worker can begin after teardown; reject it before any Matrix or
      // IndexedDB work starts.
      if (
        this.storeBroken ||
        !this.isCurrent(generation) ||
        !this.hasCurrentRoom(roomId)
      ) {
        return;
      }
      const room = this.client.getRoom(roomId);
      if (!room) {
        throw new Error("Current room is not available in the Matrix client.");
      }
      // Capture the revision before an optional `/members` request.
      const revision = this.roomRevisions.get(roomId) ?? 0;
      const record = await hydrateRoom({
        client: this.client,
        room,
        currentRecord: this.records.get(roomId),
        isCurrent: () => this.isCurrent(generation) && !this.storeBroken,
      });
      // Hydration may include retries and `/members`. It cannot be cancelled,
      // so re-check lifecycle, room visibility, and membership after it returns.
      if (
        !record ||
        this.storeBroken ||
        !this.isCurrent(generation) ||
        !this.hasCurrentRoom(roomId) ||
        !this.isRecordCurrent(record)
      ) {
        return;
      }
      // A live event arrived during hydration. Requeue a fresh SDK snapshot.
      if ((this.roomRevisions.get(roomId) ?? 0) !== revision) {
        this.enqueueRoom(roomId);
        return;
      }
      await this.persistRoom(record, true);
    } catch (error) {
      // A request/write can reject after teardown. Its error belongs to the old
      // client and must not update failure counters or UI state.
      if (!this.isCurrent(generation)) {
        return;
      }
      // A broken store surfaces here too, through a failed `persistRoom`.
      if (isNewerSchemaVersionError(error)) {
        this.handlePersistenceError(error);
        return;
      }
      if (
        error instanceof MatrixError &&
        (error.httpStatus === 403 || error.httpStatus === 404)
      ) {
        // A stale authoritative list commonly produces 403/404 after a leave.
        // Reconcile membership before deciding whether this is a real failure.
        await this.reconcileMissingRoom(roomId, generation);
        return;
      }
      console.warn(
        "Matrix conversation search could not index a room",
        nonSensitiveErrorKind(error),
      );
      this.failedRoomIds.add(roomId);
      this.scheduleStatusPublish(false);
    }
  }

  /**
   * Recheck authoritative membership after `/members` returns 403 or 404.
   * Expected leave/invite races remove stale records; a still-current room is
   * retained as a visible indexing failure instead of being silently dropped.
   */
  private async reconcileMissingRoom(
    roomId: string,
    generation: number,
  ): Promise<void> {
    try {
      // A 403/404 can be a normal race with a leave or cancelled invitation.
      const joinedRoomIds = await this.getJoinedRoomIds();
      // The authoritative request may resolve after stop/account switch. Ignore
      // its result instead of mutating an obsolete index instance.
      if (!this.isCurrent(generation)) {
        return;
      }
      this.joinedRoomIds = joinedRoomIds;
      this.invitedRoomIds = this.currentInvitedRoomIds();
      const currentRoomIds = this.currentRoomIds();
      const removedRoomIds = [...this.records.keys()].filter(
        (storedRoomId) => !currentRoomIds.has(storedRoomId),
      );
      if (removedRoomIds.length > 0) {
        await this.removeRoomRecords(removedRoomIds, true);
      }
      // The deletion can commit before teardown. Do not continue by marking a
      // room as failed when this reconciliation no longer owns current state.
      if (!this.isCurrent(generation)) {
        return;
      }
      // If Matrix still considers the room current, the access failure remains
      // actionable and the completed queue must surface an error state.
      if (currentRoomIds.has(roomId)) {
        this.failedRoomIds.add(roomId);
      }
    } catch {
      // Report the failure only while this generation still owns the UI state.
      if (this.isCurrent(generation)) {
        this.failedRoomIds.add(roomId);
      }
    }
  }

  /**
   * Commit a room to IndexedDB before publishing it to the in-memory index.
   * All durable mutations share one queue so invocation order is preserved.
   */
  private persistRoom(
    record: MatrixConversationSearchRoomRecord,
    resultsChanged: boolean,
  ): Promise<void> {
    const generation = this.generation;
    // Update IndexedDB before memory so a failed transaction cannot expose a
    // result that the application believes was durably saved.
    return this.serializePersistence(async () => {
      // This operation may have waited behind older writes. If stop() happened
      // while queued, skip the IndexedDB write entirely.
      if (!this.isCurrent(generation)) {
        return;
      }
      await this.store.putRoom(record);
      // `putRoom` may already have committed before stop(). This check cannot
      // roll it back; it prevents the obsolete index from updating memory and UI.
      if (!this.isCurrent(generation)) {
        return;
      }
      this.records.set(record.roomId, record);
      if (record.memberIndexMode === "full") {
        // A successful promotion (or any full snapshot) releases the room's
        // one promotion attempt; only demoted-again rooms stay latched.
        this.promotionAttemptedRoomIds.delete(record.roomId);
      }
      this.scheduleStatusPublish(resultsChanged);
    });
  }

  /**
   * Delete rooms durably, then mirror the committed deletion in memory.
   * Pending hydration and failure markers for those rooms are cleared together.
   */
  private removeRoomRecords(
    roomIds: Iterable<string>,
    resultsChanged: boolean,
  ): Promise<void> {
    // Normalize arbitrary iterables and prevent duplicate delete requests.
    const ids = [...new Set(roomIds)];
    if (ids.length === 0) {
      return Promise.resolve();
    }
    const generation = this.generation;
    return this.serializePersistence(async () => {
      // This deletion may have waited behind older writes. If stop() happened
      // while queued, skip touching the database for the obsolete client.
      if (!this.isCurrent(generation)) {
        return;
      }
      const removedRecords = ids.filter((roomId) =>
        this.records.has(roomId),
      ).length;
      await this.store.deleteRooms(ids);
      // The database deletion may already be committed. After teardown, do not
      // continue mutating the old in-memory trackers or notifying its UI.
      if (!this.isCurrent(generation)) {
        return;
      }
      // Mirror the committed durable deletion across all in-memory trackers.
      ids.forEach((roomId) => {
        this.records.delete(roomId);
        this.failedRoomIds.delete(roomId);
        this.promotionAttemptedRoomIds.delete(roomId);
        this.roomQueue.removePending(roomId);
      });
      this.scheduleStatusPublish(resultsChanged && removedRecords > 0);
    });
  }

  /** Append a mutation to the failure-tolerant global persistence queue. */
  private serializePersistence(operation: () => Promise<void>): Promise<void> {
    // Preserve invocation order across writes and later room removals.
    const current = this.persistenceQueue
      // Keep later writes usable after an earlier IndexedDB failure.
      .catch(() => undefined)
      .then(operation);
    this.persistenceQueue = current;
    return current;
  }

  /** Set the public phase and publish now or through the normal throttle. */
  private setPhase(
    phase: ChatSearchIndexStatus["phase"],
    immediate = false,
  ): void {
    this.status = this.currentStatus(phase);
    // Terminal and user-visible transitions bypass the normal one-second
    // progress throttle.
    if (immediate) {
      this.publishStatus();
    } else {
      this.scheduleStatusPublish(false);
    }
  }

  /** Recompute public counters from records valid for current membership. */
  private currentStatus(
    phase: ChatSearchIndexStatus["phase"] = this.status.phase,
  ): ChatSearchIndexStatus {
    return {
      phase,
      // Membership-stale records remain in memory briefly but are neither
      // searchable nor counted as indexed until their replacement commits.
      indexedRooms: [...this.records.values()].filter((record) =>
        this.isRecordCurrent(record),
      ).length,
      totalRooms: this.currentRoomIds().size,
      failedRooms: this.failedRoomIds.size,
    };
  }

  /** Coalesce frequent progress and result notifications into one update. */
  private scheduleStatusPublish(resultsChanged: boolean): void {
    if (this.stopped) {
      return;
    }
    // Coalesce result invalidation: one meaningful change in the batch is
    // enough for the eventual driver event to request refreshed results.
    this.pendingResultsChanged ||= resultsChanged;
    if (this.statusTimer !== null) {
      return;
    }
    // Large initial indexes should not trigger a React Query update per room.
    this.statusTimer = window.setTimeout(() => {
      this.statusTimer = null;
      this.publishStatus();
    }, STATUS_THROTTLE_MS);
  }

  /** Publish the latest recomputed status through the driver event bridge. */
  private publishStatus(): void {
    if (this.stopped) {
      return;
    }
    if (this.statusTimer !== null) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    // Recompute at publication time so counts include every coalesced mutation.
    this.status = this.currentStatus(this.status.phase);
    const resultsChanged = this.pendingResultsChanged;
    this.pendingResultsChanged = false;
    this.onStatusChanged({ ...this.status }, resultsChanged);
  }

  /** Invalidate any asynchronous snapshot started for this room. */
  private bumpRoomRevision(roomId: string): void {
    // Revisions are local invalidation counters, not Matrix event versions.
    this.roomRevisions.set(roomId, (this.roomRevisions.get(roomId) ?? 0) + 1);
  }

  /**
   * Enter the terminal state for this store instance and drop queued hydration,
   * so no further `/members` request is spent on writes that cannot commit.
   * Workers already past their fetch finish harmlessly.
   */
  private markStoreBroken(): void {
    this.storeBroken = true;
    this.roomQueue.clearPending();
    this.dirtyRoomIds.clear();
    this.reconcileRequested = false;
  }

  /** Surface a persistence failure while keeping valid loaded results usable. */
  private handlePersistenceError(error: unknown): void {
    if (!this.stopped) {
      if (isNewerSchemaVersionError(error)) {
        // A newer schema makes retries unsafe for this client version; stop
        // hydration until a reload serves compatible application code.
        this.markStoreBroken();
      }
      console.warn(
        "Matrix conversation search persistence failed",
        nonSensitiveErrorKind(error),
      );
      // Existing valid results remain readable, but durability is incomplete.
      this.setPhase("error", true);
    }
  }

  /** Start the reconciliation requested while another pass was active. */
  private replayRequestedReconciliation(): void {
    if (!this.reconcileRequested || this.stopped || this.storeBroken) {
      return;
    }
    this.reconcileRequested = false;
    this.reconcile();
  }

  /** Read incoming invitation ids from the SDK's currently visible rooms. */
  private currentInvitedRoomIds(): Set<string> {
    // Incoming invitations are visible in synced SDK rooms but not returned by
    // the authoritative `/joined_rooms` endpoint.
    return new Set(
      this.client
        .getVisibleRooms()
        .filter((room) => room.getMyMembership() === KnownMembership.Invite)
        .map((room) => room.roomId),
    );
  }

  /** Return the union of authoritative joined rooms and synced invitations. */
  private currentRoomIds(): Set<string> {
    // Return a new set so callers cannot mutate either source collection.
    return new Set([...this.joinedRoomIds, ...this.invitedRoomIds]);
  }

  /** Check whether a room is currently eligible to appear in search. */
  private hasCurrentRoom(roomId: string): boolean {
    // Fast identity-only check used before queueing work.
    return this.joinedRoomIds.has(roomId) || this.invitedRoomIds.has(roomId);
  }

  /** Check both room visibility and the record's join/invite direction. */
  private isRecordCurrent(record: MatrixConversationSearchRoomRecord): boolean {
    // Check both identity and membership direction. A join<->invite transition
    // makes the previous record unusable until a replacement is persisted.
    return record.currentUserMembership === KnownMembership.Invite
      ? this.invitedRoomIds.has(record.roomId)
      : this.joinedRoomIds.has(record.roomId);
  }

  /**
   * Return whether asynchronous work still belongs to this live index instance.
   * `stop()` changes generation; the comparison turns old continuations into
   * no-ops without pretending to cancel or roll back their completed effects.
   */
  private isCurrent(generation: number): boolean {
    // Promises cannot always be cancelled, so stale generations become no-ops.
    return !this.stopped && this.generation === generation;
  }
}
