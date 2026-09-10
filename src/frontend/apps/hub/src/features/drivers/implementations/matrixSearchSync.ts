import {
  ClientEvent,
  IndexedDBStore,
  SyncState,
  type MatrixClient,
  type SyncStateData,
} from "matrix-js-sdk/lib/matrix";

import type {
  SearchCheckpoint,
  SearchDelta,
} from "@/features/chat/search/storage";

type RawEvent = {
  type?: string;
  state_key?: string;
  event_id?: string;
  content?: Record<string, unknown>;
};
type RawRoom = {
  summary?: { "m.joined_member_count"?: unknown };
  state?: { events?: RawEvent[] };
  timeline?: { events?: RawEvent[] };
  "org.matrix.msc4222.state_after"?: { events?: RawEvent[] };
};
type RawRooms = {
  join?: Record<string, RawRoom>;
  leave?: Record<string, unknown>;
};

/** Projects only final state; message content never enters the search index. */
export const projectSearchRooms = (
  rooms: RawRooms,
): Pick<SearchCheckpoint, "rooms" | "left"> => ({
  left: Object.keys(rooms.leave ?? {}),
  rooms: Object.entries(rooms.join ?? {}).map(([id, room]) => {
    const delta: SearchDelta = { id, members: [] };
    if (room.summary && Object.hasOwn(room.summary, "m.joined_member_count")) {
      const count = room.summary["m.joined_member_count"];
      delta.count =
        typeof count === "number" && Number.isSafeInteger(count) && count >= 0
          ? count
          : null;
    }
    const events = room["org.matrix.msc4222.state_after"]?.events ?? [
      ...(room.state?.events ?? []),
      ...(room.timeline?.events ?? []).filter(
        (event) => event.state_key !== undefined,
      ),
    ];
    for (const event of events) {
      if (event.type === "m.room.member") {
        if (
          !event.content ||
          typeof event.state_key !== "string" ||
          !event.state_key.startsWith("@") ||
          typeof event.event_id !== "string" ||
          !event.event_id ||
          !["join", "invite", "leave", "ban", "knock"].includes(
            String(event.content?.membership),
          )
        ) {
          delta.invalid = true;
          continue;
        }
        delta.members.push({
          id: event.state_key,
          name:
            typeof event.content.displayname === "string" &&
            event.content.displayname.trim()
              ? event.content.displayname
              : event.state_key,
          joined: event.content.membership === "join",
        });
      } else if (event.type === "m.room.name" && event.state_key === "") {
        delta.name =
          typeof event.content?.name === "string" ? event.content.name : "";
      } else if (
        event.type === "m.room.canonical_alias" &&
        event.state_key === ""
      ) {
        delta.alias =
          typeof event.content?.alias === "string" ? event.content.alias : "";
      }
    }
    return delta;
  }),
});

type Observer = {
  initial: (checkpoint: SearchCheckpoint | null) => void;
  completed: (checkpoint: SearchCheckpoint, caughtUp: boolean) => void;
  stale: (invalidate?: boolean) => void;
  durable: (token: string) => void;
};

/** Public store adapter, verified against matrix-js-sdk 41.6.0 classic sync. */
export const observeMatrixSearchSync = async (
  mx: MatrixClient,
  observer: Observer,
): Promise<() => void> => {
  const store = mx.store;
  let pending: SearchCheckpoint | undefined;
  let completedToken: string | undefined;
  let failed = false;
  let disposed = false;
  let degraded = !(store instanceof IndexedDBStore);
  let saving = false;
  const safely = (run: () => void) => {
    if (disposed) return;
    try {
      run();
    } catch {
      observer.stale(true);
    }
  };
  // This read occurs after initClient's cache repair, before startClient.
  try {
    const saved = await store.getSavedSync();
    completedToken = saved?.nextBatch;
    observer.initial(
      saved
        ? {
            token: saved.nextBatch,
            ...projectSearchRooms(saved.roomsData as RawRooms),
          }
        : null,
    );
  } catch {
    observer.initial(null);
  }
  const originalSet = store.setSyncData;
  const originalSave = store.save;
  store.setSyncData = async (data) => {
    await originalSet.call(store, data);
    safely(() => {
      pending = {
        token: data.next_batch,
        oldToken: completedToken,
        ...projectSearchRooms((data.rooms ?? {}) as RawRooms),
      };
    });
  };
  store.save = async (force = false) => {
    // Concurrent saves in the SDK can share an older backend write. Only
    // anchor the first, certain, non-no-op write and its captured token.
    const canAnchor =
      !saving &&
      !degraded &&
      !pending &&
      !failed &&
      completedToken === store.getSyncToken() &&
      (force || store.wantsSave());
    const token = completedToken;
    if (canAnchor) saving = true;
    try {
      await originalSave.call(store, force);
      if (canAnchor && !degraded && token)
        safely(() => observer.durable(token));
    } finally {
      if (canAnchor) saving = false;
    }
  };
  const onUnexpected = () => {
    failed = true;
    safely(() => observer.stale(true));
  };
  const onDegraded = () => {
    degraded = true;
  };
  const onSync = (
    state: SyncState,
    _previous: SyncState | null,
    data?: SyncStateData,
  ) => {
    if (state === SyncState.Error || state === SyncState.Stopped) {
      safely(() => observer.stale());
      return;
    }
    if (state !== SyncState.Syncing || data?.fromCache) return;
    const checkpoint = pending;
    pending = undefined;
    if (
      failed ||
      !checkpoint ||
      checkpoint.token !== data?.nextSyncToken ||
      checkpoint.oldToken !== data.oldSyncToken
    ) {
      failed = false;
      completedToken = data?.nextSyncToken;
      safely(() => observer.stale(true));
      return;
    }
    completedToken = checkpoint.token;
    safely(() => observer.completed(checkpoint, !data.catchingUp));
  };
  mx.on(ClientEvent.Sync, onSync);
  mx.on(ClientEvent.SyncUnexpectedError, onUnexpected);
  if (store instanceof IndexedDBStore) {
    store.on("degraded", onDegraded);
    store.on("closed", onDegraded);
  }
  return () => {
    disposed = true;
    store.setSyncData = originalSet;
    store.save = originalSave;
    mx.off(ClientEvent.Sync, onSync);
    mx.off(ClientEvent.SyncUnexpectedError, onUnexpected);
    // 41.6.0 exposes on(), but no public off() on IndexedDBStore. The two
    // closures retain only this adapter's flags and die with the owned store.
  };
};
