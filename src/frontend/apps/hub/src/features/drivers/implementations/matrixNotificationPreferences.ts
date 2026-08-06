import {
  type MatrixClient,
  type MatrixEvent,
  PushRuleActionName,
  type Room,
  RoomEvent,
} from "matrix-js-sdk/lib/matrix";

import { type ChatNotificationPreferences } from "../types";

export const MATRIX_ROOM_NOTIFICATION_PREFERENCES =
  "im.suite.hub.room_notification_preferences";
export const MATRIX_THREAD_NOTIFICATION_PREFERENCES_PREFIX =
  "im.suite.hub.thread_notification_preferences.";

const ACCOUNT_DATA_VERSION = 1 as const;
const DEFAULT_ROOM_CONTENT: MatrixRoomNotificationPreferencesContent = {
  version: ACCOUNT_DATA_VERSION,
  muted: false,
};

export type MatrixRoomNotificationPreferencesContent = {
  version: typeof ACCOUNT_DATA_VERSION;
  muted: boolean;
  /** Ranking cursor frozen at mute time and retained during no-replay. */
  frozenRankingActivityAt?: string;
  /** Activity seen at unmute; only a newer event resumes live ranking. */
  ignoreActivityThroughAt?: string;
};

export type MatrixThreadNotificationPreferencesContent = {
  version: typeof ACCOUNT_DATA_VERSION;
  threadId: string;
  muted: boolean;
};

type StoredRoomPreferences = {
  room: MatrixRoomNotificationPreferencesContent;
  threads: Map<string, MatrixThreadNotificationPreferencesContent>;
  threadIdByEventType: Map<string, string>;
};

export type MatrixNotificationPreferencesChange = {
  roomId: string;
  preferences: ChatNotificationPreferences;
};

type ChangeListener = (change: MatrixNotificationPreferencesChange) => void;

type CustomRoomAccountDataWriter = (
  roomId: string,
  eventType: string,
  content: Record<string, unknown>,
) => Promise<unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseTimestamp = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : undefined;
};

/**
 * Parse canonical Hub room account data. Unknown versions and malformed
 * optional ranking fields are ignored as a whole, so corrupt data can never
 * accidentally mute a room.
 */
export const parseMatrixRoomNotificationPreferences = (
  content: unknown,
): MatrixRoomNotificationPreferencesContent | undefined => {
  if (
    !isRecord(content) ||
    content.version !== ACCOUNT_DATA_VERSION ||
    typeof content.muted !== "boolean"
  ) {
    return undefined;
  }

  const hasFrozen = content.frozenRankingActivityAt !== undefined;
  const hasBaseline = content.ignoreActivityThroughAt !== undefined;
  const frozenRankingActivityAt = parseTimestamp(
    content.frozenRankingActivityAt,
  );
  const ignoreActivityThroughAt = parseTimestamp(
    content.ignoreActivityThroughAt,
  );

  if (
    (hasFrozen && !frozenRankingActivityAt) ||
    (hasBaseline && !ignoreActivityThroughAt) ||
    (content.muted && (!hasFrozen || hasBaseline))
  ) {
    return undefined;
  }

  // A baseline only has meaning paired with a frozen cursor after unmute.
  if (!content.muted && hasFrozen !== hasBaseline) {
    return undefined;
  }

  return {
    version: ACCOUNT_DATA_VERSION,
    muted: content.muted,
    ...(frozenRankingActivityAt ? { frozenRankingActivityAt } : {}),
    ...(!content.muted && ignoreActivityThroughAt
      ? { ignoreActivityThroughAt }
      : {}),
  };
};

/** Parse one per-thread Hub account-data tombstone. */
export const parseMatrixThreadNotificationPreferences = (
  content: unknown,
): MatrixThreadNotificationPreferencesContent | undefined => {
  if (
    !isRecord(content) ||
    content.version !== ACCOUNT_DATA_VERSION ||
    typeof content.threadId !== "string" ||
    !content.threadId ||
    typeof content.muted !== "boolean"
  ) {
    return undefined;
  }
  return {
    version: ACCOUNT_DATA_VERSION,
    threadId: content.threadId,
    muted: content.muted,
  };
};

/**
 * A deterministic, browser-safe 64-bit key (two independent 32-bit hashes).
 * The suffix is always 17 characters; the full root id remains in the event
 * content and is validated when reading, so this is an address rather than an
 * identity boundary.
 */
export const stableMatrixThreadPreferenceKey = (threadId: string): string => {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < threadId.length; index += 1) {
    const code = threadId.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
    second ^= second >>> 13;
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, "0");
  return `v1-${hex(first)}${hex(second)}`;
};

export const matrixThreadPreferenceEventType = (threadId: string): string =>
  `${MATRIX_THREAD_NOTIFICATION_PREFERENCES_PREFIX}${stableMatrixThreadPreferenceKey(threadId)}`;

const timestampForRoom = (room: Room): string =>
  new Date(Math.max(0, room.getLastActiveTimestamp())).toISOString();

const cloneRoomContent = (
  content: MatrixRoomNotificationPreferencesContent,
): MatrixRoomNotificationPreferencesContent => ({ ...content });

const defaultStoredPreferences = (): StoredRoomPreferences => ({
  room: cloneRoomContent(DEFAULT_ROOM_CONTENT),
  threads: new Map(),
  threadIdByEventType: new Map(),
});

const roomContentSignature = (
  content: MatrixRoomNotificationPreferencesContent,
): string => JSON.stringify(content);

const threadContentSignature = (
  content: MatrixThreadNotificationPreferencesContent,
): string => JSON.stringify(content);

const eventEchoKey = (roomId: string, eventType: string): string =>
  `${roomId}\u0000${eventType}`;

const getEventContent = (event: MatrixEvent): unknown =>
  event.getContent() as unknown;

const isThreadPreferenceEvent = (eventType: string): boolean =>
  eventType.startsWith(MATRIX_THREAD_NOTIFICATION_PREFERENCES_PREFIX);

/**
 * Matrix persistence and ranking state machine for Hub notification
 * preferences. One instance belongs to one MatrixClient/account.
 */
export class MatrixNotificationPreferencesService {
  private readonly snapshots = new Map<string, StoredRoomPreferences>();
  private readonly roomWrites = new Map<string, Promise<void>>();
  private readonly pendingEchoes = new Map<string, string[]>();
  private readonly eventRevisions = new Map<string, number>();
  private attached = false;

  public constructor(
    private readonly mx: MatrixClient,
    private readonly onChange: ChangeListener = () => undefined,
  ) {}

  /** Read every joined/invited room's local account-data snapshot. */
  public hydrate(): Record<string, ChatNotificationPreferences> {
    this.snapshots.clear();
    for (const room of this.mx.getRooms()) {
      this.hydrateRoom(room);
    }
    return this.getAll();
  }

  public attach(): void {
    if (this.attached) return;
    this.mx.on(RoomEvent.AccountData, this.handleAccountData);
    this.attached = true;
  }

  public detach(): void {
    if (!this.attached) return;
    this.mx.off(RoomEvent.AccountData, this.handleAccountData);
    this.attached = false;
  }

  /** Release account-scoped state on logout/client replacement. */
  public clear(): void {
    this.detach();
    this.snapshots.clear();
    this.roomWrites.clear();
    this.pendingEchoes.clear();
    this.eventRevisions.clear();
  }

  public getAll(): Record<string, ChatNotificationPreferences> {
    // ClientEvent.Room can precede adapter wiring. Lazily include rooms added
    // after the initial hydrate so a later query still returns a complete map.
    for (const room of this.mx.getRooms()) {
      if (!this.snapshots.has(room.roomId)) this.hydrateRoom(room);
    }
    return Object.fromEntries(
      [...this.snapshots.keys()].map((roomId) => [
        roomId,
        this.getForRoom(roomId),
      ]),
    );
  }

  public getForRoom(roomId: string): ChatNotificationPreferences {
    const room = this.mx.getRoom(roomId);
    const stored =
      this.snapshots.get(roomId) ??
      (room ? this.hydrateRoom(room) : defaultStoredPreferences());
    const rankingActivityAt = this.projectRankingActivityAt(
      roomId,
      stored.room,
    );
    return {
      room: {
        muted: stored.room.muted,
        ...(rankingActivityAt ? { rankingActivityAt } : {}),
      },
      threads: Object.fromEntries(
        [...stored.threads].map(([threadId, content]) => [
          threadId,
          { muted: content.muted },
        ]),
      ),
    };
  }

  /** Hydrate a room introduced after the initial sync and publish its state. */
  public handleRoom(room: Room): ChatNotificationPreferences {
    const previous = this.snapshots.has(room.roomId)
      ? this.getForRoom(room.roomId)
      : undefined;
    this.hydrateRoom(room);
    const preferences = this.getForRoom(room.roomId);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(preferences)) {
      this.onChange({ roomId: room.roomId, preferences });
    }
    return preferences;
  }

  /**
   * Mirror the standard room push rule, then commit Hub's canonical account
   * data. If the second write fails, restore the exact previous mute state.
   */
  public setRoomMuted(roomId: string, muted: boolean): Promise<void> {
    return this.enqueueRoomWrite(roomId, async () => {
      const room = this.requireRoom(roomId);
      const stored = this.ensureSnapshot(room);
      const previousContent = cloneRoomContent(stored.room);
      const previousPushMuted = this.isRoomPushMuted(roomId);
      const revision = this.eventRevision(
        roomId,
        MATRIX_ROOM_NOTIFICATION_PREFERENCES,
      );
      const currentRanking =
        this.projectRankingActivityAt(roomId, previousContent) ??
        timestampForRoom(room);
      const nextContent: MatrixRoomNotificationPreferencesContent = muted
        ? {
            version: ACCOUNT_DATA_VERSION,
            muted: true,
            frozenRankingActivityAt: currentRanking,
          }
        : {
            version: ACCOUNT_DATA_VERSION,
            muted: false,
            ...(previousContent.frozenRankingActivityAt
              ? {
                  frozenRankingActivityAt:
                    previousContent.frozenRankingActivityAt,
                  ignoreActivityThroughAt: timestampForRoom(room),
                }
              : {}),
          };

      try {
        await this.setRoomPushMuted(roomId, muted);
        await this.writeAccountData(
          roomId,
          MATRIX_ROOM_NOTIFICATION_PREFERENCES,
          nextContent,
          roomContentSignature(nextContent),
        );
      } catch (error) {
        const remoteChanged =
          this.eventRevision(roomId, MATRIX_ROOM_NOTIFICATION_PREFERENCES) !==
          revision;
        const recovered = this.hydrateRoom(room, true);
        try {
          await this.setRoomPushMuted(
            roomId,
            remoteChanged ? recovered.room.muted : previousPushMuted,
          );
        } catch {
          // Best effort: reconnect reconciliation repairs a failed rollback.
        }
        throw error;
      }

      if (
        this.eventRevision(roomId, MATRIX_ROOM_NOTIFICATION_PREFERENCES) ===
        revision
      ) {
        stored.room = nextContent;
        this.emitChange(roomId);
      }
    });
  }

  /** One account-data event per thread prevents unrelated lost updates. */
  public setThreadMuted({
    roomId,
    threadId,
    muted,
  }: {
    roomId: string;
    threadId: string;
    muted: boolean;
  }): Promise<void> {
    return this.enqueueRoomWrite(roomId, async () => {
      const room = this.requireRoom(roomId);
      const stored = this.ensureSnapshot(room);
      const eventType = matrixThreadPreferenceEventType(threadId);
      const existingThreadId = stored.threadIdByEventType.get(eventType);
      if (existingThreadId && existingThreadId !== threadId) {
        throw new Error("Matrix thread notification preference key collision");
      }
      const content: MatrixThreadNotificationPreferencesContent = {
        version: ACCOUNT_DATA_VERSION,
        threadId,
        muted,
      };
      const revision = this.eventRevision(roomId, eventType);
      await this.writeAccountData(
        roomId,
        eventType,
        content,
        threadContentSignature(content),
      );
      if (this.eventRevision(roomId, eventType) === revision) {
        stored.threads.set(threadId, content);
        stored.threadIdByEventType.set(eventType, threadId);
        this.emitChange(roomId);
      }
    });
  }

  /**
   * Called for timeline activity. While muted it is deliberately inert. After
   * unmute, the first event newer than the baseline resumes live ranking and
   * persists removal of the stale cursor.
   */
  public handleRoomActivity(roomId: string): Promise<void> {
    return this.enqueueRoomWrite(roomId, async () => {
      const room = this.requireRoom(roomId);
      const stored = this.ensureSnapshot(room);
      if (!this.shouldResumeLiveRanking(room, stored.room)) return;

      const nextContent = cloneRoomContent(DEFAULT_ROOM_CONTENT);
      const revision = this.eventRevision(
        roomId,
        MATRIX_ROOM_NOTIFICATION_PREFERENCES,
      );
      // Ranking resumption is derived from the already-received activity. Make
      // it visible immediately even if persistence is temporarily offline;
      // reconnect reconciliation will retry the canonical cleanup.
      stored.room = nextContent;
      this.emitChange(roomId);
      await this.writeAccountData(
        roomId,
        MATRIX_ROOM_NOTIFICATION_PREFERENCES,
        nextContent,
        roomContentSignature(nextContent),
      );
      // Restore the local projection only if no newer account-data event was
      // observed while persistence was pending. A later SDK echo will still
      // converge to the server's final value.
      if (
        this.eventRevision(roomId, MATRIX_ROOM_NOTIFICATION_PREFERENCES) ===
          revision &&
        roomContentSignature(stored.room) !== roomContentSignature(nextContent)
      ) {
        stored.room = nextContent;
        this.emitChange(roomId);
      }
    });
  }

  /** Repair derived push rules and stale no-replay metadata after reconnect. */
  public async reconcile(): Promise<void> {
    const rooms = this.mx.getRooms();
    await Promise.all(
      rooms.map((room) =>
        this.enqueueRoomWrite(room.roomId, async () => {
          const before = this.snapshots.has(room.roomId)
            ? this.getForRoom(room.roomId)
            : undefined;
          // Re-hydration belongs inside the same per-room queue as writes.
          // Pending successful PUTs have no local SDK echo yet, so preserve
          // those event types over a potentially stale Room account-data map.
          const stored = this.hydrateRoom(room, true);
          const after = this.getForRoom(room.roomId);
          if (!before || JSON.stringify(before) !== JSON.stringify(after)) {
            this.onChange({ roomId: room.roomId, preferences: after });
          }
          if (this.shouldResumeLiveRanking(room, stored.room)) {
            const nextContent = cloneRoomContent(DEFAULT_ROOM_CONTENT);
            const revision = this.eventRevision(
              room.roomId,
              MATRIX_ROOM_NOTIFICATION_PREFERENCES,
            );
            stored.room = nextContent;
            this.emitChange(room.roomId);
            await this.writeAccountData(
              room.roomId,
              MATRIX_ROOM_NOTIFICATION_PREFERENCES,
              nextContent,
              roomContentSignature(nextContent),
            );
            if (
              this.eventRevision(
                room.roomId,
                MATRIX_ROOM_NOTIFICATION_PREFERENCES,
              ) === revision &&
              roomContentSignature(stored.room) !==
                roomContentSignature(nextContent)
            ) {
              stored.room = nextContent;
              this.emitChange(room.roomId);
            }
          }

          if (this.isRoomPushMuted(room.roomId) !== stored.room.muted) {
            await this.setRoomPushMuted(room.roomId, stored.room.muted);
          }
        }),
      ),
    );
  }

  /** Public for direct SDK listener wiring and isolated unit tests. */
  public readonly handleAccountData = (
    event: MatrixEvent,
    room: Room,
  ): void => {
    const eventType = event.getType();
    if (
      eventType !== MATRIX_ROOM_NOTIFICATION_PREFERENCES &&
      !isThreadPreferenceEvent(eventType)
    ) {
      return;
    }

    const content = getEventContent(event);
    const signature = this.signatureForEvent(eventType, content);
    if (
      signature &&
      signature === this.snapshotSignatureForEvent(room.roomId, eventType) &&
      this.consumePendingEcho(room.roomId, eventType, signature)
    ) {
      return;
    }
    // A non-matching account-data event is a genuine remote value which
    // supersedes every older local echo expectation for this event type.
    this.pendingEchoes.delete(eventEchoKey(room.roomId, eventType));
    this.bumpEventRevision(room.roomId, eventType);

    const hadSnapshot = this.snapshots.has(room.roomId);
    const before = hadSnapshot
      ? this.getForRoom(room.roomId)
      : ({
          room: { muted: false },
          threads: {},
        } satisfies ChatNotificationPreferences);
    const stored = hadSnapshot
      ? this.snapshots.get(room.roomId)!
      : this.hydrateRoom(room);
    // For a newly seen room, hydration has already consumed the event from the
    // SDK accountData map. Existing rooms apply only the changed event.
    if (hadSnapshot) {
      if (eventType === MATRIX_ROOM_NOTIFICATION_PREFERENCES) {
        stored.room =
          parseMatrixRoomNotificationPreferences(content) ??
          cloneRoomContent(DEFAULT_ROOM_CONTENT);
      } else {
        this.applyThreadEvent(stored, eventType, content);
      }
    }
    const after = this.getForRoom(room.roomId);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      this.onChange({ roomId: room.roomId, preferences: after });
    }
    if (eventType === MATRIX_ROOM_NOTIFICATION_PREFERENCES) {
      void this.enqueueRoomWrite(room.roomId, async () => {
        const canonicalMuted = this.getForRoom(room.roomId).room.muted;
        if (this.isRoomPushMuted(room.roomId) !== canonicalMuted) {
          await this.setRoomPushMuted(room.roomId, canonicalMuted);
        }
      }).catch(() => undefined);
    }
  };

  private hydrateRoom(
    room: Room,
    preservePendingEchoes = false,
  ): StoredRoomPreferences {
    const previous = this.snapshots.get(room.roomId);
    const stored = defaultStoredPreferences();
    const roomContent = room
      .getAccountData(MATRIX_ROOM_NOTIFICATION_PREFERENCES)
      ?.getContent();
    stored.room =
      parseMatrixRoomNotificationPreferences(roomContent) ??
      cloneRoomContent(DEFAULT_ROOM_CONTENT);
    if (preservePendingEchoes && roomContent) {
      const signature = this.signatureForEvent(
        MATRIX_ROOM_NOTIFICATION_PREFERENCES,
        roomContent,
      );
      if (signature) {
        this.consumePendingEcho(
          room.roomId,
          MATRIX_ROOM_NOTIFICATION_PREFERENCES,
          signature,
        );
      }
    }

    for (const [eventType, event] of room.accountData) {
      if (isThreadPreferenceEvent(eventType)) {
        const content = getEventContent(event);
        this.applyThreadEvent(stored, eventType, content);
        if (preservePendingEchoes) {
          const signature = this.signatureForEvent(eventType, content);
          if (signature) {
            this.consumePendingEcho(room.roomId, eventType, signature);
          }
        }
      }
    }
    if (preservePendingEchoes && previous) {
      if (
        this.hasPendingEcho(room.roomId, MATRIX_ROOM_NOTIFICATION_PREFERENCES)
      ) {
        stored.room = cloneRoomContent(previous.room);
      }
      for (const [eventType, threadId] of previous.threadIdByEventType) {
        if (!this.hasPendingEcho(room.roomId, eventType)) {
          continue;
        }
        const content = previous.threads.get(threadId);
        if (content) {
          stored.threads.set(threadId, { ...content });
          stored.threadIdByEventType.set(eventType, threadId);
        }
      }
    }
    this.snapshots.set(room.roomId, stored);
    return stored;
  }

  private ensureSnapshot(room: Room, hydrate = true): StoredRoomPreferences {
    const existing = this.snapshots.get(room.roomId);
    if (existing) return existing;
    if (hydrate) return this.hydrateRoom(room);
    const stored = defaultStoredPreferences();
    this.snapshots.set(room.roomId, stored);
    return stored;
  }

  private applyThreadEvent(
    stored: StoredRoomPreferences,
    eventType: string,
    rawContent: unknown,
  ): void {
    const previousThreadId = stored.threadIdByEventType.get(eventType);
    if (previousThreadId) {
      stored.threads.delete(previousThreadId);
      stored.threadIdByEventType.delete(eventType);
    }

    const content = parseMatrixThreadNotificationPreferences(rawContent);
    if (
      !content ||
      matrixThreadPreferenceEventType(content.threadId) !== eventType
    ) {
      return;
    }
    stored.threads.set(content.threadId, content);
    stored.threadIdByEventType.set(eventType, content.threadId);
  }

  private projectRankingActivityAt(
    roomId: string,
    content: MatrixRoomNotificationPreferencesContent,
  ): string | undefined {
    if (!content.frozenRankingActivityAt) return undefined;
    if (content.muted) return content.frozenRankingActivityAt;
    const room = this.mx.getRoom(roomId);
    return room && this.shouldResumeLiveRanking(room, content)
      ? undefined
      : content.frozenRankingActivityAt;
  }

  private shouldResumeLiveRanking(
    room: Room,
    content: MatrixRoomNotificationPreferencesContent,
  ): boolean {
    if (
      content.muted ||
      !content.frozenRankingActivityAt ||
      !content.ignoreActivityThroughAt
    ) {
      return false;
    }
    return (
      room.getLastActiveTimestamp() >
      Date.parse(content.ignoreActivityThroughAt)
    );
  }

  private requireRoom(roomId: string): Room {
    const room = this.mx.getRoom(roomId);
    if (!room) throw new Error(`Unknown Matrix room: ${roomId}`);
    return room;
  }

  private isRoomPushMuted(roomId: string): boolean {
    const rule = this.mx.getRoomPushRule("global", roomId);
    return Boolean(rule?.actions.includes(PushRuleActionName.DontNotify));
  }

  private async setRoomPushMuted(
    roomId: string,
    muted: boolean,
  ): Promise<void> {
    await (this.mx.setRoomMutePushRule("global", roomId, muted) ??
      Promise.resolve());
  }

  private async writeAccountData(
    roomId: string,
    eventType: string,
    content:
      | MatrixRoomNotificationPreferencesContent
      | MatrixThreadNotificationPreferencesContent,
    signature: string,
  ): Promise<void> {
    this.addPendingEcho(roomId, eventType, signature);
    try {
      // The SDK restricts eventType to registered keys. Hub's namespaced custom
      // event is valid over the Matrix API but requires this narrow cast.
      const write = this.mx
        .setRoomAccountData as unknown as CustomRoomAccountDataWriter;
      await write.call(this.mx, roomId, eventType, { ...content });
    } catch (error) {
      this.removePendingEcho(roomId, eventType, signature);
      throw error;
    }
  }

  private enqueueRoomWrite(
    roomId: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    const previous = this.roomWrites.get(roomId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.roomWrites.set(roomId, current);
    const cleanup = () => {
      if (this.roomWrites.get(roomId) === current) {
        this.roomWrites.delete(roomId);
      }
    };
    void current.then(cleanup, cleanup);
    return current;
  }

  private emitChange(roomId: string): void {
    this.onChange({ roomId, preferences: this.getForRoom(roomId) });
  }

  private signatureForEvent(
    eventType: string,
    content: unknown,
  ): string | undefined {
    if (eventType === MATRIX_ROOM_NOTIFICATION_PREFERENCES) {
      const parsed = parseMatrixRoomNotificationPreferences(content);
      return parsed ? roomContentSignature(parsed) : undefined;
    }
    const parsed = parseMatrixThreadNotificationPreferences(content);
    return parsed &&
      matrixThreadPreferenceEventType(parsed.threadId) === eventType
      ? threadContentSignature(parsed)
      : undefined;
  }

  private snapshotSignatureForEvent(
    roomId: string,
    eventType: string,
  ): string | undefined {
    const stored = this.snapshots.get(roomId);
    if (!stored) {
      return undefined;
    }
    if (eventType === MATRIX_ROOM_NOTIFICATION_PREFERENCES) {
      return roomContentSignature(stored.room);
    }
    const threadId = stored.threadIdByEventType.get(eventType);
    const content = threadId ? stored.threads.get(threadId) : undefined;
    return content ? threadContentSignature(content) : undefined;
  }

  private addPendingEcho(
    roomId: string,
    eventType: string,
    signature: string,
  ): void {
    const key = eventEchoKey(roomId, eventType);
    this.pendingEchoes.set(key, [
      ...(this.pendingEchoes.get(key) ?? []),
      signature,
    ]);
  }

  private hasPendingEcho(roomId: string, eventType: string): boolean {
    return (
      (this.pendingEchoes.get(eventEchoKey(roomId, eventType))?.length ?? 0) > 0
    );
  }

  private eventRevision(roomId: string, eventType: string): number {
    return this.eventRevisions.get(eventEchoKey(roomId, eventType)) ?? 0;
  }

  private bumpEventRevision(roomId: string, eventType: string): void {
    const key = eventEchoKey(roomId, eventType);
    this.eventRevisions.set(key, (this.eventRevisions.get(key) ?? 0) + 1);
  }

  private consumePendingEcho(
    roomId: string,
    eventType: string,
    signature: string,
  ): boolean {
    const key = eventEchoKey(roomId, eventType);
    const pending = this.pendingEchoes.get(key);
    // Room account data is last-write-wins and /sync may coalesce several
    // successful local PUTs into only the newest value. Matching the newest
    // equivalent write and dropping every superseded expectation prevents a
    // stale signature from swallowing a later genuine remote change.
    const index = pending?.lastIndexOf(signature) ?? -1;
    if (!pending || index < 0) return false;
    pending.splice(0, index + 1);
    if (!pending.length) this.pendingEchoes.delete(key);
    return true;
  }

  private removePendingEcho(
    roomId: string,
    eventType: string,
    signature: string,
  ): void {
    const key = eventEchoKey(roomId, eventType);
    const pending = this.pendingEchoes.get(key);
    const index = pending?.lastIndexOf(signature) ?? -1;
    if (!pending || index < 0) return;
    // A failed PUT invalidates only its own expectation. Unlike a /sync echo,
    // it says nothing about older successful writes which may still be
    // coalesced or delivered later.
    pending.splice(index, 1);
    if (!pending.length) this.pendingEchoes.delete(key);
  }
}
