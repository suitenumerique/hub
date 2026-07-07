import {
  ClientEvent,
  RelationsEvent,
  RoomEvent,
  SyncState,
  ThreadEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  type Thread,
} from "matrix-js-sdk/lib/matrix";
import { KnownMembership } from "matrix-js-sdk/lib/@types/membership";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMockChatDocuments } from "../../mocks/mockDocuments";
import {
  MatrixDriver,
  redactionEventToChatEvent,
  timelineEventToChatEvent,
} from "../MatrixDriver";

const initClientMock = vi.hoisted(() => vi.fn());
const startClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/matrix/initMatrix", () => ({
  initClient: initClientMock,
  startClient: startClientMock,
}));

const ROOM_ID = "!room:localhost";
const SELF_ID = "@me:localhost";
const OTHER_ID = "@alice:localhost";
const SENT_EVENT_ID = "$sent:localhost";

/** A single annotation reaction on a message, for the room relation store. */
type SeedReaction = {
  key: string;
  sender: string;
  id?: string;
  redacted?: boolean;
  /** Local-echo markers — present marks the reaction as THIS session's echo. */
  status?: string | null;
  transactionId?: string;
  txnId?: string;
};

const makeReactionEvent = (
  targetId: string,
  reaction: SeedReaction,
): MatrixEvent =>
  ({
    isRedacted: () => Boolean(reaction.redacted),
    getSender: () => reaction.sender,
    getId: () => reaction.id ?? `$react-${reaction.sender}-${reaction.key}`,
    getType: () => "m.reaction",
    getRoomId: () => ROOM_ID,
    status: reaction.status ?? null,
    isBeingDecrypted: () => false,
    shouldAttemptDecryption: () => false,
    getUnsigned: () =>
      reaction.transactionId ? { transaction_id: reaction.transactionId } : {},
    getTxnId: () => reaction.txnId,
    getRelation: () => ({
      rel_type: "m.annotation",
      event_id: targetId,
      key: reaction.key,
    }),
  }) as unknown as MatrixEvent;

type TestRelations = {
  getRelations: () => MatrixEvent[];
  getSortedAnnotationsByKey: () => [string, Set<MatrixEvent>][];
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emitRedaction: (event: MatrixEvent) => void;
};

/** A minimal `RelationsContainer` over seeded annotations, keyed by target id. */
const makeRelationsStore = (
  reactionsByEvent?: Record<string, SeedReaction[]>,
) => {
  const relationsByEvent = new Map<string, TestRelations>();
  return {
    getChildEventsForEvent: (eventId: string) => {
      const seeded = reactionsByEvent?.[eventId];
      if (!seeded) {
        return undefined;
      }
      const existing = relationsByEvent.get(eventId);
      if (existing) {
        return existing;
      }
      const listeners = new Map<string, Set<(event: MatrixEvent) => void>>();
      const events = () =>
        seeded.map((reaction) => makeReactionEvent(eventId, reaction));
      const relations: TestRelations = {
        getRelations: events,
        getSortedAnnotationsByKey: () => {
          const byKey = new Map<string, Set<MatrixEvent>>();
          for (const event of events()) {
            const key = event.getRelation()?.key ?? "";
            if (!byKey.has(key)) {
              byKey.set(key, new Set());
            }
            byKey.get(key)?.add(event);
          }
          return [...byKey.entries()];
        },
        on: vi.fn(
          (eventName: string, listener: (event: MatrixEvent) => void) => {
            if (!listeners.has(eventName)) {
              listeners.set(eventName, new Set());
            }
            listeners.get(eventName)?.add(listener);
          },
        ),
        off: vi.fn(
          (eventName: string, listener: (event: MatrixEvent) => void) => {
            listeners.get(eventName)?.delete(listener);
          },
        ),
        emitRedaction: (event: MatrixEvent) => {
          listeners
            .get(RelationsEvent.Redaction)
            ?.forEach((listener) => listener(event));
        },
      };
      relationsByEvent.set(eventId, relations);
      return relations;
    },
  };
};

type RoomOptions = {
  threads?: Thread[];
  /** Message events served by the live timeline (latest page). */
  timelineEvents?: MatrixEvent[];
  /** Annotation reactions keyed by the message id they relate to. */
  reactionsByEvent?: Record<string, SeedReaction[]>;
  /** Events resolvable through `findEventById`. */
  eventsById?: Record<string, MatrixEvent>;
  /** Read-up-to per user: main-timeline event ids the user has read. */
  readBy?: Record<string, string[]>;
  /** Highlight (mention) notification count surfaced by the homeserver. */
  highlightCount?: number;
  /** The current user's room membership; defaults to `join`. */
  membership?: string;
  /** Display name of the joined counterpart (drives a direct chat's name). */
  counterpartName?: string;
  /** Joined members; defaults to the connected user + one counterpart (a 1:1). */
  joinedMembers?: { userId: string; name: string }[];
  /** Explicit `m.room.name`, when the room has been named (a group salon). */
  roomName?: string;
};

/**
 * A Matrix room shaped for the read/thread/reaction methods exercised here:
 * members/counts/timestamp for `matrixRoomToLocalChat`, a live timeline for
 * `getChatMessages`, a threads list, a relation store for reactions, and
 * `findEventById` for the bridge and mutation results.
 */
const makeRoom = (opts: RoomOptions = {}): Room => {
  const joinedMembers = opts.joinedMembers ?? [
    { userId: SELF_ID, name: "Me" },
    { userId: OTHER_ID, name: opts.counterpartName ?? "Alice Martin" },
  ];
  return {
    roomId: ROOM_ID,
    name: "Project room",
    getMembers: () => joinedMembers.map((member) => ({ userId: member.userId })),
    getJoinedMembers: () => joinedMembers,
    getJoinedMemberCount: () => joinedMembers.length,
    getLastActiveTimestamp: () => 1_700_000_000_000,
    getMyMembership: () => opts.membership ?? KnownMembership.Join,
    currentState: {
      getStateEvents: (type: string) =>
        type === "m.room.name" && opts.roomName
          ? { getContent: () => ({ name: opts.roomName }) }
          : null,
    },
    getLiveTimeline: () => ({
      getEvents: () => opts.timelineEvents ?? [],
      getPaginationToken: () => "t-mock",
    }),
    getMember: (id: string) => ({ name: id === SELF_ID ? "Me" : id }),
    getThreads: () => opts.threads ?? [],
    getThread: (id: string) =>
      (opts.threads ?? []).find((thread) => thread.id === id) ?? null,
    fetchRoomThreads: async () => undefined,
    findEventById: (id: string) => opts.eventsById?.[id],
    hasUserReadEvent: (userId: string, eventId: string) =>
      (opts.readBy?.[userId] ?? []).includes(eventId),
    getRoomUnreadNotificationCount: (type: string) =>
      type === "highlight" ? (opts.highlightCount ?? 0) : 0,
    relations: makeRelationsStore(opts.reactionsByEvent),
  } as unknown as Room;
};

const makeClient = (room: Room | null): MatrixClient =>
  ({
    getUserId: () => SELF_ID,
    getRoom: (id: string) => (room && id === room.roomId ? room : null),
    getVisibleRooms: () => (room ? [room] : []),
    paginateEventTimeline: async () => false,
    sendTextMessage: vi.fn(async () => ({ event_id: SENT_EVENT_ID })),
    sendEvent: vi.fn(async () => ({ event_id: SENT_EVENT_ID })),
    redactEvent: vi.fn(async () => ({ event_id: "$redacted:localhost" })),
    sendReadReceipt: vi.fn(async () => ({})),
  }) as unknown as MatrixClient;

/**
 * A timeline event shaped just enough for the mappers: type, sender, body, id,
 * timestamp, an optional thread-root marker, an optional relation (edit, or an
 * annotation when it is a reaction event), and the local-echo markers.
 */
const makeMessageEvent = (opts: {
  sender: string;
  body?: string;
  id?: string;
  ts?: number;
  type?: string;
  threadRootId?: string;
  relation?: { rel_type: string; event_id: string; key?: string };
  newBody?: string;
  status?: string | null;
  transactionId?: string;
  txnId?: string;
}): MatrixEvent =>
  ({
    getType: () => opts.type ?? "m.room.message",
    isRedacted: () => false,
    getId: () => opts.id ?? "$ev:localhost",
    getSender: () => opts.sender,
    getTs: () => opts.ts ?? 1_700_000_000_000,
    threadRootId: opts.threadRootId,
    status: opts.status ?? null,
    getContent: () => ({
      body: opts.body ?? "",
      ...(opts.newBody ? { "m.new_content": { body: opts.newBody } } : {}),
    }),
    getRelation: () => opts.relation ?? null,
    getUnsigned: () =>
      opts.transactionId ? { transaction_id: opts.transactionId } : {},
    getTxnId: () => opts.txnId,
  }) as unknown as MatrixEvent;

type ThreadOptions = {
  id: string;
  rootEvent?: MatrixEvent;
  replyToEvent?: MatrixEvent | null;
  events?: MatrixEvent[];
  length?: number;
  /** Read-up-to per user: event ids the user has read. */
  readBy?: Record<string, string[]>;
  /** Reactions on thread replies live in the thread's own relations container. */
  timelineSetRelations?: Record<string, SeedReaction[]>;
};

const makeThread = (opts: ThreadOptions): Thread =>
  ({
    id: opts.id,
    rootEvent: opts.rootEvent,
    replyToEvent: opts.replyToEvent ?? null,
    events: opts.events ?? [],
    length: opts.length ?? 0,
    liveTimeline: {},
    timelineSet: { relations: makeRelationsStore(opts.timelineSetRelations) },
    hasUserReadEvent: (userId: string, eventId: string) =>
      (opts.readBy?.[userId] ?? []).includes(eventId),
  }) as unknown as Thread;

/** Injects a live client without driving the OIDC/`connect` flow. */
const driverWithClient = (mx: MatrixClient): MatrixDriver => {
  const driver = new MatrixDriver();
  (driver as unknown as { mx: MatrixClient }).mx = mx;
  return driver;
};

const makeEmptyStorage = (): Storage =>
  ({
    clear: vi.fn(),
    getItem: vi.fn(() => null),
    key: vi.fn(() => null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
    length: 0,
  }) as unknown as Storage;

const attachThreadRoom = (thread: Thread, room: Room): Thread => {
  (thread as unknown as { room: Room }).room = room;
  return thread;
};

type MatrixListener = (...args: unknown[]) => void;

const makeLiveClient = (
  room: Room,
): {
  client: MatrixClient;
  emitSdkEvent: (eventName: string, ...args: unknown[]) => void;
  off: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
} => {
  const clientListeners = new Map<string, Set<MatrixListener>>();
  const roomListeners = new Map<string, Set<MatrixListener>>();
  const addListener = (
    listeners: Map<string, Set<MatrixListener>>,
    eventName: string,
    listener: MatrixListener,
  ) => {
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }
    listeners.get(eventName)?.add(listener);
  };
  const removeListener = (
    listeners: Map<string, Set<MatrixListener>>,
    eventName: string,
    listener: MatrixListener,
  ) => listeners.get(eventName)?.delete(listener);
  const on = vi.fn((eventName: string, listener: MatrixListener) => {
    addListener(clientListeners, eventName, listener);
  });
  const off = vi.fn((eventName: string, listener: MatrixListener) => {
    removeListener(clientListeners, eventName, listener);
  });
  const roomOn = vi.fn((eventName: string, listener: MatrixListener) => {
    addListener(roomListeners, eventName, listener);
  });
  const roomOff = vi.fn((eventName: string, listener: MatrixListener) => {
    removeListener(roomListeners, eventName, listener);
  });
  (room as unknown as { off: typeof roomOff; on: typeof roomOn }).on = roomOn;
  (room as unknown as { off: typeof roomOff; on: typeof roomOn }).off = roomOff;
  const client = {
    ...makeClient(room),
    getRooms: () => [room],
    off,
    on,
    stopClient: vi.fn(),
  } as unknown as MatrixClient;
  return {
    client,
    emitSdkEvent: (eventName: string, ...args: unknown[]) => {
      roomListeners.get(eventName)?.forEach((listener) => listener(...args));
      clientListeners.get(eventName)?.forEach((listener) => listener(...args));
    },
    off,
    on,
  };
};

const bootstrapDriverWithClient = async (
  client: MatrixClient,
): Promise<MatrixDriver> => {
  vi.stubGlobal("localStorage", makeEmptyStorage());
  initClientMock.mockResolvedValue(client);
  startClientMock.mockResolvedValue(undefined);
  const driver = new MatrixDriver();
  await (
    driver as unknown as {
      bootstrapClient: (user: {
        accessToken: string;
        homeserverUrl: string;
        mxId: string;
      }) => Promise<void>;
    }
  ).bootstrapClient({
    accessToken: "token",
    homeserverUrl: "http://localhost:9808",
    mxId: SELF_ID,
  });
  return driver;
};

describe("MatrixDriver real single-conversation read", () => {
  it("names a direct conversation after the counterpart, ignoring the room name", async () => {
    // `makeRoom` has a room name ("Project room") but only two joined members,
    // so it is a 1:1 and must show the other person, never the room name.
    const driver = driverWithClient(makeClient(makeRoom()));

    const chat = await driver.getChat(ROOM_ID);

    expect(chat.id).toBe(ROOM_ID);
    expect(chat.kind).toBe("direct");
    expect(chat.name).toBe("Alice Martin");
    expect(chat.section).toBe("all");
    // The connected user is filtered out of the participants.
    expect(chat.participantIds).toEqual([OTHER_ID]);
  });

  it("uses the counterpart's display name even when the 1:1 room has a name", async () => {
    const driver = driverWithClient(
      makeClient(
        makeRoom({ counterpartName: "Bob Dubois", roomName: "Renamed salon" }),
      ),
    );

    const chat = await driver.getChat(ROOM_ID);

    expect(chat.kind).toBe("direct");
    expect(chat.name).toBe("Bob Dubois");
  });

  it("names a nameless group after its members, not just the first one", async () => {
    const driver = driverWithClient(
      makeClient(
        makeRoom({
          joinedMembers: [
            { userId: SELF_ID, name: "Me" },
            { userId: OTHER_ID, name: "Hub" },
            { userId: "@webkit:localhost", name: "E2E WebKit" },
          ],
        }),
      ),
    );

    const chat = await driver.getChat(ROOM_ID);

    expect(chat.kind).toBe("group");
    expect(chat.name).toBe("Hub, E2E WebKit");
    expect(chat.visual).toEqual({ kind: "icon", icon: "groups" });
  });

  it("keeps the explicit name for a named group", async () => {
    const driver = driverWithClient(
      makeClient(
        makeRoom({
          roomName: "Projet Hub",
          joinedMembers: [
            { userId: SELF_ID, name: "Me" },
            { userId: OTHER_ID, name: "Hub" },
            { userId: "@webkit:localhost", name: "E2E WebKit" },
          ],
        }),
      ),
    );

    const chat = await driver.getChat(ROOM_ID);

    expect(chat.kind).toBe("group");
    expect(chat.name).toBe("Projet Hub");
  });

  it("throws for a room the client does not know", async () => {
    const driver = driverWithClient(makeClient(null));

    await expect(driver.getChat(ROOM_ID)).rejects.toThrow(/not found/);
  });

  it("throws when the client is not connected", async () => {
    const driver = new MatrixDriver();

    await expect(driver.getChat(ROOM_ID)).rejects.toThrow(/not connected/);
  });
});

describe("MatrixDriver read state (getUnread)", () => {
  it("flags a conversation unread from another sender's unread message", async () => {
    const message = makeMessageEvent({ sender: OTHER_ID, id: "$m1:localhost" });
    const driver = driverWithClient(
      makeClient(makeRoom({ timelineEvents: [message] })),
    );

    const unread = await driver.getUnread();

    expect(unread[ROOM_ID]).toEqual({ unread: true, highlight: false });
  });

  it("clears the unread flag once that message is read", async () => {
    const message = makeMessageEvent({ sender: OTHER_ID, id: "$m1:localhost" });
    const driver = driverWithClient(
      makeClient(
        makeRoom({
          timelineEvents: [message],
          readBy: { [SELF_ID]: ["$m1:localhost"] },
        }),
      ),
    );

    const unread = await driver.getUnread();

    expect(unread[ROOM_ID].unread).toBe(false);
  });

  it("never flags unread from the connected user's own messages", async () => {
    const message = makeMessageEvent({ sender: SELF_ID, id: "$mine:localhost" });
    const driver = driverWithClient(
      makeClient(makeRoom({ timelineEvents: [message] })),
    );

    const unread = await driver.getUnread();

    expect(unread[ROOM_ID].unread).toBe(false);
  });

  it("sets the highlight bit from the room's mention notification count", async () => {
    const message = makeMessageEvent({ sender: OTHER_ID, id: "$m1:localhost" });
    const driver = driverWithClient(
      makeClient(makeRoom({ timelineEvents: [message], highlightCount: 1 })),
    );

    const unread = await driver.getUnread();

    expect(unread[ROOM_ID]).toEqual({ unread: true, highlight: true });
  });

  it("flags a conversation unread from an unread thread reply (no main unread)", async () => {
    const root = makeMessageEvent({ sender: SELF_ID, id: "$root:localhost" });
    const reply = makeMessageEvent({ sender: OTHER_ID, id: "$tr:localhost" });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      events: [root, reply],
      readBy: {},
    });
    const driver = driverWithClient(
      makeClient(makeRoom({ threads: [thread] })),
    );

    const unread = await driver.getUnread();

    expect(unread[ROOM_ID].unread).toBe(true);
  });

  it("ignores a thread whose replies the user has read", async () => {
    const root = makeMessageEvent({ sender: SELF_ID, id: "$root:localhost" });
    const reply = makeMessageEvent({ sender: OTHER_ID, id: "$tr:localhost" });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      events: [root, reply],
      readBy: { [SELF_ID]: ["$tr:localhost"] },
    });
    const driver = driverWithClient(
      makeClient(makeRoom({ threads: [thread] })),
    );

    const unread = await driver.getUnread();

    expect(unread[ROOM_ID].unread).toBe(false);
  });
});

describe("MatrixDriver deliberately mocked surfaces", () => {
  it("serves documents from the shared mock", async () => {
    const driver = new MatrixDriver();

    expect(await driver.getChatDocuments()).toEqual(getMockChatDocuments());
  });
});

const INVITE_ROOM_ID = "!invite:localhost";
const INVITER_ID = "@bob:localhost";

/** The current user's `m.room.member` invite event, as the SDK exposes it. */
const makeInviteEvent = (
  opts: {
    sender?: string;
    reason?: string;
    isDirect?: boolean;
    ts?: number;
  } = {},
): MatrixEvent =>
  ({
    getSender: () => opts.sender ?? INVITER_ID,
    getTs: () => opts.ts ?? 1_700_000_500_000,
    getContent: () => ({
      ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
      ...(opts.isDirect !== undefined ? { is_direct: opts.isDirect } : {}),
    }),
  }) as unknown as MatrixEvent;

/**
 * An invited room: `invite` membership, the current user's invite event on their
 * own member, and the inviter's stripped-state member carrying a display name.
 */
const makeInviteRoom = (
  opts: {
    roomId?: string;
    name?: string;
    inviterId?: string;
    inviterName?: string;
    inviteEvent?: MatrixEvent;
  } = {},
): Room => {
  const inviterId = opts.inviterId ?? INVITER_ID;
  const inviteEvent =
    opts.inviteEvent ?? makeInviteEvent({ sender: inviterId });
  return {
    roomId: opts.roomId ?? INVITE_ROOM_ID,
    name: opts.name ?? "",
    getMyMembership: () => KnownMembership.Invite,
    getMembers: () => [{ userId: SELF_ID }, { userId: inviterId }],
    getJoinedMemberCount: () => 0,
    getLastActiveTimestamp: () => 0,
    getMember: (id: string) => {
      if (id === SELF_ID) {
        return { name: "Me", events: { member: inviteEvent } };
      }
      if (id === inviterId) {
        return { name: opts.inviterName ?? inviterId };
      }
      return null;
    },
  } as unknown as Room;
};

describe("MatrixDriver incoming invitations (mapping)", () => {
  it("maps an invited room to an invitation chat with metadata", async () => {
    const room = makeInviteRoom({
      name: "Project invite",
      inviterName: "Bob Dubois",
      inviteEvent: makeInviteEvent({
        sender: INVITER_ID,
        reason: "Join us",
        ts: 1_700_000_500_000,
      }),
    });
    const driver = driverWithClient(makeClient(room));

    const chat = await driver.getChat(INVITE_ROOM_ID);

    expect(chat.membership).toBe("invite");
    expect(chat.visual).toEqual({ kind: "icon", icon: "mail" });
    expect(chat.kind).toBe("group");
    expect(chat.name).toBe("Project invite");
    // The inviter is the only participant an invite reliably exposes.
    expect(chat.participantIds).toEqual([INVITER_ID]);
    expect(chat.invitation).toEqual({
      inviterId: INVITER_ID,
      inviterName: "Bob Dubois",
      reason: "Join us",
      invitedAt: new Date(1_700_000_500_000).toISOString(),
    });
  });

  it("uses the invite event timestamp as lastActivityAt (list sorting input)", async () => {
    const ts = 1_700_009_000_000;
    const driver = driverWithClient(
      makeClient(makeInviteRoom({ inviteEvent: makeInviteEvent({ ts }) })),
    );

    const chat = await driver.getChat(INVITE_ROOM_ID);

    expect(chat.lastActivityAt).toBe(new Date(ts).toISOString());
  });

  it("marks a direct invite as direct and names it after the inviter", async () => {
    const room = makeInviteRoom({
      name: "",
      inviterName: "Bob Dubois",
      inviteEvent: makeInviteEvent({ sender: INVITER_ID, isDirect: true }),
    });
    const driver = driverWithClient(makeClient(room));

    const chat = await driver.getChat(INVITE_ROOM_ID);

    expect(chat.kind).toBe("direct");
    expect(chat.invitation?.isDirect).toBe(true);
    // Empty room name falls back to the inviter's display name.
    expect(chat.name).toBe("Bob Dubois");
  });

  it("includes invited rooms in the chat list", async () => {
    const driver = driverWithClient(makeClient(makeInviteRoom()));

    const { all } = await driver.getChats();

    expect(all).toHaveLength(1);
    expect(all[0].membership).toBe("invite");
  });

  it("excludes rooms the user has left from the chat list", async () => {
    // A refused invite (or any left room) lingers in the SDK store but must not
    // resurface as a joined row.
    const mx = {
      getUserId: () => SELF_ID,
      getVisibleRooms: () => [makeRoom({ membership: KnownMembership.Leave })],
    } as unknown as MatrixClient;
    const driver = driverWithClient(mx);

    const { all } = await driver.getChats();

    expect(all).toEqual([]);
  });

  it("maps a joined room with membership join (backwards compatible)", async () => {
    const driver = driverWithClient(makeClient(makeRoom()));

    const chat = await driver.getChat(ROOM_ID);

    expect(chat.membership).toBe("join");
    expect(chat.invitation).toBeUndefined();
  });
});

describe("MatrixDriver incoming invitations (accept/refuse)", () => {
  it("accepts by joining the room, maps it joined, and emits chats:changed", async () => {
    const joinedRoom = makeRoom();
    const joinRoom = vi.fn(async () => joinedRoom);
    const mx = {
      getUserId: () => SELF_ID,
      getRoom: (id: string) => (id === ROOM_ID ? joinedRoom : null),
      joinRoom,
    } as unknown as MatrixClient;
    const driver = driverWithClient(mx);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    const chat = await driver.acceptChatInvitation(ROOM_ID);

    expect(joinRoom).toHaveBeenCalledWith(ROOM_ID);
    expect(chat.membership).toBe("join");
    expect(events).toEqual([{ type: "chats:changed" }]);
  });

  it("refuses by leaving the room and emits chats:changed", async () => {
    const leave = vi.fn(async () => ({}));
    const mx = {
      getUserId: () => SELF_ID,
      leave,
    } as unknown as MatrixClient;
    const driver = driverWithClient(mx);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    await driver.refuseChatInvitation(ROOM_ID);

    expect(leave).toHaveBeenCalledWith(ROOM_ID);
    expect(events).toEqual([{ type: "chats:changed" }]);
  });

  it("throws from accept and refuse when the client is not connected", async () => {
    const offline = new MatrixDriver();

    await expect(offline.acceptChatInvitation(ROOM_ID)).rejects.toThrow(
      /not connected/,
    );
    await expect(offline.refuseChatInvitation(ROOM_ID)).rejects.toThrow(
      /not connected/,
    );
  });
});

describe("MatrixDriver incoming invitations (getChatForUsers)", () => {
  it("does not resolve a pending invite as an existing conversation", async () => {
    const inviteRoom = makeInviteRoom({ inviterId: OTHER_ID });
    const mx = {
      getUserId: () => SELF_ID,
      getVisibleRooms: () => [inviteRoom],
    } as unknown as MatrixClient;
    const driver = driverWithClient(mx);

    await expect(driver.getChatForUsers([OTHER_ID])).resolves.toBeNull();
  });

  it("still resolves a joined conversation for the same participants", async () => {
    const mx = {
      getUserId: () => SELF_ID,
      getVisibleRooms: () => [makeRoom()],
    } as unknown as MatrixClient;
    const driver = driverWithClient(mx);

    const match = await driver.getChatForUsers([OTHER_ID]);

    expect(match?.id).toBe(ROOM_ID);
    expect(match?.membership).toBe("join");
  });
});

/** Directory entry shaped like the homeserver `searchUserDirectory` response. */
type SeedDirectoryUser = { user_id: string; display_name?: string };

/** A client whose only behaviour is a stubbed user-directory search. */
const directoryClient = (
  results: SeedDirectoryUser[],
  searchSpy = vi.fn(),
): MatrixClient =>
  ({
    getUserId: () => SELF_ID,
    searchUserDirectory: async (options: { term: string; limit?: number }) => {
      searchSpy(options);
      return { limited: false, results };
    },
  }) as unknown as MatrixClient;

describe("MatrixDriver people search", () => {
  it("maps directory results to ChatUsers", async () => {
    const driver = driverWithClient(
      directoryClient([
        { user_id: "@alice:localhost", display_name: "Alice Martin" },
      ]),
    );

    const [alice] = await driver.getChatUsers({ q: "ali" });

    expect(alice).toMatchObject({
      id: "@alice:localhost",
      name: "Alice Martin",
      initials: "AM",
      email: "@alice:localhost",
      subtitle: "@alice:localhost",
    });
    expect(alice.color).toBeTruthy();
  });

  it("falls back to the localpart when a result has no display name", async () => {
    const driver = driverWithClient(
      directoryClient([{ user_id: "@bob:localhost" }]),
    );

    const [bob] = await driver.getChatUsers({ q: "bob" });

    expect(bob.name).toBe("bob");
    expect(bob.initials).toBe("B");
  });

  it("excludes the connected user and already-selected participants", async () => {
    const driver = driverWithClient(
      directoryClient([
        { user_id: SELF_ID, display_name: "Me" },
        { user_id: "@alice:localhost", display_name: "Alice" },
        { user_id: "@bob:localhost", display_name: "Bob" },
      ]),
    );

    const users = await driver.getChatUsers({
      q: "a",
      excludeIds: ["@bob:localhost"],
    });

    expect(users.map((user) => user.id)).toEqual(["@alice:localhost"]);
  });

  it("short-circuits an empty query without hitting the homeserver", async () => {
    const searchSpy = vi.fn();
    const driver = driverWithClient(directoryClient([], searchSpy));

    expect(await driver.getChatUsers({ q: "   " })).toEqual([]);
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("returns nothing when the client is not connected", async () => {
    const driver = new MatrixDriver();

    expect(await driver.getChatUsers({ q: "alice" })).toEqual([]);
  });
});

/** A visible room defined only by its members, for participant-set matching. */
const roomWithMembers = (roomId: string, memberIds: string[]): Room =>
  ({
    roomId,
    name: roomId,
    getMembers: () => memberIds.map((userId) => ({ userId })),
    getJoinedMembers: () => memberIds.map((userId) => ({ userId, name: userId })),
    getJoinedMemberCount: () => memberIds.length,
    getLastActiveTimestamp: () => 1_700_000_000_000,
    getMyMembership: () => KnownMembership.Join,
  }) as unknown as Room;

const roomsClient = (rooms: Room[]): MatrixClient =>
  ({
    getUserId: () => SELF_ID,
    getVisibleRooms: () => rooms,
  }) as unknown as MatrixClient;

describe("MatrixDriver existing-conversation resolution", () => {
  it("resolves a direct conversation from a single participant", async () => {
    const driver = driverWithClient(
      roomsClient([roomWithMembers("!dm:localhost", [SELF_ID, OTHER_ID])]),
    );

    const chat = await driver.getChatForUsers([OTHER_ID]);

    expect(chat?.id).toBe("!dm:localhost");
    expect(chat?.kind).toBe("direct");
    expect(chat?.participantIds).toEqual([OTHER_ID]);
  });

  it("resolves a group conversation regardless of participant order", async () => {
    const driver = driverWithClient(
      roomsClient([
        roomWithMembers("!dm:localhost", [SELF_ID, OTHER_ID]),
        roomWithMembers("!group:localhost", [
          SELF_ID,
          "@bob:localhost",
          "@carole:localhost",
        ]),
      ]),
    );

    const chat = await driver.getChatForUsers([
      "@carole:localhost",
      "@bob:localhost",
    ]);

    expect(chat?.id).toBe("!group:localhost");
    expect(chat?.kind).toBe("group");
  });

  it("returns null when no visible room matches the set", async () => {
    const driver = driverWithClient(
      roomsClient([roomWithMembers("!dm:localhost", [SELF_ID, OTHER_ID])]),
    );

    expect(await driver.getChatForUsers(["@nobody:localhost"])).toBeNull();
  });

  it("returns null for an empty set or when not connected", async () => {
    const connected = driverWithClient(roomsClient([]));
    expect(await connected.getChatForUsers([])).toBeNull();

    const offline = new MatrixDriver();
    expect(await offline.getChatForUsers([OTHER_ID])).toBeNull();
  });
});

/** A client that creates rooms and serves them back by id once created. */
const creatingClient = (opts: {
  visibleRooms?: Room[];
  createdRoom: Room;
  createdRoomId: string;
}): { client: MatrixClient; createRoom: ReturnType<typeof vi.fn> } => {
  const createRoom = vi.fn(async () => ({ room_id: opts.createdRoomId }));
  let created = false;
  const client = {
    getUserId: () => SELF_ID,
    getVisibleRooms: () => opts.visibleRooms ?? [],
    getRoom: (id: string) =>
      created && id === opts.createdRoomId ? opts.createdRoom : null,
    createRoom: (...args: unknown[]) => {
      created = true;
      return createRoom(...args);
    },
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as MatrixClient;
  return { client, createRoom };
};

describe("MatrixDriver.createChatForUsers", () => {
  it("advertises conversation creation support", () => {
    expect(new MatrixDriver().supportsConversationCreation).toBe(true);
  });

  it("creates a direct room and maps it to a LocalChat", async () => {
    const createdRoom = roomWithMembers("!new:localhost", [SELF_ID, OTHER_ID]);
    const { client, createRoom } = creatingClient({
      createdRoom,
      createdRoomId: "!new:localhost",
    });
    const driver = driverWithClient(client);

    const chat = await driver.createChatForUsers([OTHER_ID]);

    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ is_direct: true, invite: [OTHER_ID] }),
    );
    expect(chat.id).toBe("!new:localhost");
    expect(chat.kind).toBe("direct");
    expect(chat.participantIds).toEqual([OTHER_ID]);
  });

  it("creates a group room for several participants", async () => {
    const createdRoom = roomWithMembers("!grp:localhost", [
      SELF_ID,
      "@bob:localhost",
      "@carole:localhost",
    ]);
    const { client, createRoom } = creatingClient({
      createdRoom,
      createdRoomId: "!grp:localhost",
    });
    const driver = driverWithClient(client);

    const chat = await driver.createChatForUsers([
      "@bob:localhost",
      "@carole:localhost",
    ]);

    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ is_direct: false }),
    );
    expect(chat.kind).toBe("group");
  });

  it("reuses an existing conversation instead of creating a duplicate", async () => {
    const existingRoom = roomWithMembers("!dm:localhost", [SELF_ID, OTHER_ID]);
    const { client, createRoom } = creatingClient({
      visibleRooms: [existingRoom],
      createdRoom: existingRoom,
      createdRoomId: "!new:localhost",
    });
    const driver = driverWithClient(client);

    const chat = await driver.createChatForUsers([OTHER_ID]);

    expect(createRoom).not.toHaveBeenCalled();
    expect(chat.id).toBe("!dm:localhost");
  });

  it("rejects an empty set or when not connected", async () => {
    const { client } = creatingClient({
      createdRoom: roomWithMembers("!x:localhost", [SELF_ID, OTHER_ID]),
      createdRoomId: "!x:localhost",
    });
    await expect(driverWithClient(client).createChatForUsers([])).rejects.toThrow();
    await expect(new MatrixDriver().createChatForUsers([OTHER_ID])).rejects.toThrow();
  });
});

describe("MatrixDriver reactions", () => {
  it("populates message reactions from m.annotation aggregation", async () => {
    const message = makeMessageEvent({
      sender: OTHER_ID,
      body: "hi",
      id: "$m1:localhost",
    });
    const room = makeRoom({
      timelineEvents: [message],
      reactionsByEvent: {
        "$m1:localhost": [
          { key: "👍", sender: SELF_ID },
          { key: "👍", sender: OTHER_ID },
          { key: "🎉", sender: OTHER_ID },
        ],
      },
    });
    const driver = driverWithClient(makeClient(room));

    const page = await driver.getChatMessages({ chatId: ROOM_ID });

    expect(page.messages[0].reactions).toEqual([
      { emoji: "👍", count: 2, reactedByMe: true },
      { emoji: "🎉", count: 1, reactedByMe: false },
    ]);
  });

  it("ignores redacted annotations when aggregating", async () => {
    const message = makeMessageEvent({ sender: OTHER_ID, id: "$m1:localhost" });
    const room = makeRoom({
      timelineEvents: [message],
      reactionsByEvent: {
        "$m1:localhost": [{ key: "👍", sender: OTHER_ID, redacted: true }],
      },
    });
    const driver = driverWithClient(makeClient(room));

    const page = await driver.getChatMessages({ chatId: ROOM_ID });

    expect(page.messages[0].reactions).toEqual([]);
  });

  it("counts at most one annotation per sender and emoji", async () => {
    const message = makeMessageEvent({ sender: OTHER_ID, id: "$m1:localhost" });
    const room = makeRoom({
      timelineEvents: [message],
      reactionsByEvent: {
        "$m1:localhost": [
          { key: "👍", sender: OTHER_ID, id: "$r1:localhost" },
          { key: "👍", sender: OTHER_ID, id: "$r2:localhost" },
          { key: "👍", sender: SELF_ID, id: "$r3:localhost" },
        ],
      },
    });
    const driver = driverWithClient(makeClient(room));

    const page = await driver.getChatMessages({ chatId: ROOM_ID });

    expect(page.messages[0].reactions).toEqual([
      { emoji: "👍", count: 2, reactedByMe: true },
    ]);
  });

  it("adds a reaction via m.annotation and returns the updated message", async () => {
    const message = makeMessageEvent({ sender: OTHER_ID, id: "$m1:localhost" });
    const room = makeRoom({ eventsById: { "$m1:localhost": message } });
    const client = makeClient(room);
    const driver = driverWithClient(client);

    const updated = await driver.toggleChatReaction({
      chatId: ROOM_ID,
      messageId: "$m1:localhost",
      emoji: "👍",
    });

    expect(vi.mocked(client.sendEvent)).toHaveBeenCalledWith(
      ROOM_ID,
      "m.reaction",
      {
        "m.relates_to": {
          rel_type: "m.annotation",
          event_id: "$m1:localhost",
          key: "👍",
        },
      },
    );
    expect(updated.reactions).toEqual([
      { emoji: "👍", count: 1, reactedByMe: true },
    ]);
  });

  it("returns the intended reaction state when the SDK local echo updates relations before resolve", async () => {
    const message = makeMessageEvent({ sender: OTHER_ID, id: "$m1:localhost" });
    const reactions: SeedReaction[] = [];
    const room = makeRoom({
      eventsById: { "$m1:localhost": message },
      reactionsByEvent: { "$m1:localhost": reactions },
    });
    const client = makeClient(room);
    vi.mocked(client.sendEvent).mockImplementation(async () => {
      reactions.push({ key: "👍", sender: SELF_ID });
      return { event_id: "$reaction:localhost" };
    });
    const driver = driverWithClient(client);

    const updated = await driver.toggleChatReaction({
      chatId: ROOM_ID,
      messageId: "$m1:localhost",
      emoji: "👍",
    });

    expect(updated.reactions).toEqual([
      { emoji: "👍", count: 1, reactedByMe: true },
    ]);
  });

  it("removes a reaction by redacting the user's own annotation", async () => {
    const message = makeMessageEvent({ sender: OTHER_ID, id: "$m1:localhost" });
    const room = makeRoom({
      eventsById: { "$m1:localhost": message },
      reactionsByEvent: {
        "$m1:localhost": [
          { key: "👍", sender: SELF_ID, id: "$myreaction:localhost" },
        ],
      },
    });
    const client = makeClient(room);
    const driver = driverWithClient(client);

    const updated = await driver.toggleChatThreadReaction({
      chatId: ROOM_ID,
      threadId: "$root:localhost",
      messageId: "$m1:localhost",
      emoji: "👍",
    });

    expect(vi.mocked(client.redactEvent)).toHaveBeenCalledWith(
      ROOM_ID,
      "$myreaction:localhost",
    );
    expect(updated.reactions).toEqual([]);
  });

  it("removes every duplicate own annotation for the same emoji", async () => {
    const message = makeMessageEvent({ sender: OTHER_ID, id: "$m1:localhost" });
    const room = makeRoom({
      eventsById: { "$m1:localhost": message },
      reactionsByEvent: {
        "$m1:localhost": [
          { key: "👍", sender: SELF_ID, id: "$myreaction1:localhost" },
          { key: "👍", sender: SELF_ID, id: "$myreaction2:localhost" },
        ],
      },
    });
    const client = makeClient(room);
    const driver = driverWithClient(client);

    const updated = await driver.toggleChatReaction({
      chatId: ROOM_ID,
      messageId: "$m1:localhost",
      emoji: "👍",
    });

    expect(vi.mocked(client.redactEvent)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(client.redactEvent)).toHaveBeenCalledWith(
      ROOM_ID,
      "$myreaction1:localhost",
    );
    expect(vi.mocked(client.redactEvent)).toHaveBeenCalledWith(
      ROOM_ID,
      "$myreaction2:localhost",
    );
    expect(vi.mocked(client.sendEvent)).not.toHaveBeenCalled();
    expect(updated.reactions).toEqual([]);
  });

  it("reads thread-reply reactions from the thread's own relations container", async () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      id: "$root:localhost",
      body: "root",
    });
    const reply = makeMessageEvent({
      sender: OTHER_ID,
      id: "$tr:localhost",
      body: "reply",
      threadRootId: "$root:localhost",
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      events: [root, reply],
      length: 1,
      // The reaction lives in the thread's container, not `room.relations`.
      timelineSetRelations: {
        "$tr:localhost": [{ key: "👍", sender: OTHER_ID }],
      },
    });
    const room = makeRoom({
      threads: [thread],
      eventsById: { "$root:localhost": root, "$tr:localhost": reply },
    });
    const driver = driverWithClient(makeClient(room));

    const detail = await driver.getChatThread({
      chatId: ROOM_ID,
      threadId: "$root:localhost",
    });
    const replyMessage = detail.messages.find((m) => m.id === "$tr:localhost");

    expect(replyMessage?.reactions).toEqual([
      { emoji: "👍", count: 1, reactedByMe: false },
    ]);
  });

  it("merges room and thread relation containers for a thread reply", async () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      id: "$root:localhost",
      body: "root",
    });
    const reply = makeMessageEvent({
      sender: OTHER_ID,
      id: "$tr:localhost",
      body: "reply",
      threadRootId: "$root:localhost",
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      events: [root, reply],
      length: 1,
      timelineSetRelations: {
        "$tr:localhost": [{ key: "👍", sender: OTHER_ID }],
      },
    });
    const room = makeRoom({
      threads: [thread],
      eventsById: { "$root:localhost": root, "$tr:localhost": reply },
      reactionsByEvent: {
        "$tr:localhost": [{ key: "👍", sender: SELF_ID }],
      },
    });
    const driver = driverWithClient(makeClient(room));

    const detail = await driver.getChatThread({
      chatId: ROOM_ID,
      threadId: "$root:localhost",
    });
    const replyMessage = detail.messages.find((m) => m.id === "$tr:localhost");

    expect(replyMessage?.reactions).toEqual([
      { emoji: "👍", count: 2, reactedByMe: true },
    ]);
  });
});

describe("MatrixDriver threads read", () => {
  it("lists and sorts threads by most recent reply", async () => {
    const rootA = makeMessageEvent({ sender: OTHER_ID, id: "$a:localhost" });
    const replyA = makeMessageEvent({
      sender: OTHER_ID,
      body: "older",
      id: "$ar:localhost",
      ts: 1_000,
    });
    const rootB = makeMessageEvent({ sender: OTHER_ID, id: "$b:localhost" });
    const replyB = makeMessageEvent({
      sender: OTHER_ID,
      body: "newer",
      id: "$br:localhost",
      ts: 2_000,
    });
    const threadA = makeThread({
      id: "$a:localhost",
      rootEvent: rootA,
      replyToEvent: replyA,
      events: [rootA, replyA],
      length: 1,
    });
    const threadB = makeThread({
      id: "$b:localhost",
      rootEvent: rootB,
      replyToEvent: replyB,
      events: [rootB, replyB],
      length: 1,
    });
    const driver = driverWithClient(
      makeClient(makeRoom({ threads: [threadA, threadB] })),
    );

    const threads = await driver.getChatThreads(ROOM_ID);

    expect(threads.map((thread) => thread.id)).toEqual([
      "$b:localhost",
      "$a:localhost",
    ]);
    expect(threads[0]).toMatchObject({
      id: "$b:localhost",
      rootMessageId: "$b:localhost",
      lastReplyPreview: "newer",
      replyCount: 1,
      unreadCount: 1,
    });
  });

  it("uses one subscribed-thread unread count for list, root button and detail", async () => {
    const root = makeMessageEvent({
      sender: SELF_ID,
      body: "root",
      id: "$root:localhost",
      ts: 1_000,
    });
    const readReply = makeMessageEvent({
      sender: OTHER_ID,
      body: "read",
      id: "$read:localhost",
      ts: 1_100,
    });
    const unreadReply = makeMessageEvent({
      sender: OTHER_ID,
      body: "unread",
      id: "$unread:localhost",
      ts: 1_200,
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      replyToEvent: unreadReply,
      events: [root, readReply, unreadReply],
      length: 2,
      readBy: { [SELF_ID]: ["$read:localhost"] },
    });
    const driver = driverWithClient(
      makeClient(makeRoom({ threads: [thread], timelineEvents: [root] })),
    );

    const [threads, messages, detail] = await Promise.all([
      driver.getChatThreads(ROOM_ID),
      driver.getChatMessages({ chatId: ROOM_ID }),
      driver.getChatThread({ chatId: ROOM_ID, threadId: "$root:localhost" }),
    ]);

    expect(threads[0].unreadCount).toBe(1);
    expect(messages.messages[0].thread).toMatchObject({
      id: "$root:localhost",
      replyCount: 2,
      unreadCount: 1,
    });
    expect(detail.firstUnreadIndex).toBe(2);
  });

  it("reads a thread detail with the first unread index", async () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      body: "root",
      id: "$r:localhost",
      ts: 1_000,
    });
    const mine = makeMessageEvent({
      sender: SELF_ID,
      body: "mine",
      id: "$rr1:localhost",
      ts: 1_100,
    });
    const theirs = makeMessageEvent({
      sender: OTHER_ID,
      body: "theirs",
      id: "$rr2:localhost",
      ts: 1_200,
    });
    const thread = makeThread({
      id: "$r:localhost",
      rootEvent: root,
      replyToEvent: theirs,
      events: [root, mine, theirs],
      length: 2,
    });
    const driver = driverWithClient(makeClient(makeRoom({ threads: [thread] })));

    const detail = await driver.getChatThread({
      chatId: ROOM_ID,
      threadId: "$r:localhost",
    });

    expect(detail.messages.map((message) => message.id)).toEqual([
      "$r:localhost",
      "$rr1:localhost",
      "$rr2:localhost",
    ]);
    expect(detail.messages.map((message) => message.authorId)).toEqual([
      OTHER_ID,
      "me",
      OTHER_ID,
    ]);
    // Root at 0, my reply at 1 (read because it is mine), their unread reply at 2.
    expect(detail.firstUnreadIndex).toBe(2);

    const threads = await driver.getChatThreads(ROOM_ID);
    expect(threads[0].unreadCount).toBe(1);
  });

  it("marks a one-to-one thread unread for the other participant", async () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      body: "root",
      id: "$root:localhost",
      ts: 1_000,
    });
    const reply = makeMessageEvent({
      sender: OTHER_ID,
      body: "reply",
      id: "$reply:localhost",
      ts: 1_100,
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      replyToEvent: reply,
      events: [root, reply],
      length: 1,
    });
    const driver = driverWithClient(makeClient(makeRoom({ threads: [thread] })));

    const [threads, detail, unread] = await Promise.all([
      driver.getChatThreads(ROOM_ID),
      driver.getChatThread({ chatId: ROOM_ID, threadId: "$root:localhost" }),
      driver.getUnread(),
    ]);

    expect(threads[0].unreadCount).toBe(1);
    expect(detail.firstUnreadIndex).toBe(1);
    expect(unread[ROOM_ID].unread).toBe(true);
  });

  it("does not mark a group thread unread for someone outside the thread", async () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      body: "root",
      id: "$root:localhost",
      ts: 1_000,
    });
    const reply = makeMessageEvent({
      sender: OTHER_ID,
      body: "reply",
      id: "$reply:localhost",
      ts: 1_100,
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      replyToEvent: reply,
      events: [root, reply],
      length: 1,
    });
    const driver = driverWithClient(
      makeClient(
        makeRoom({
          threads: [thread],
          joinedMembers: [
            { userId: SELF_ID, name: "Me" },
            { userId: OTHER_ID, name: "Alice" },
            { userId: "@bob:localhost", name: "Bob" },
          ],
        }),
      ),
    );

    const [threads, detail, unread] = await Promise.all([
      driver.getChatThreads(ROOM_ID),
      driver.getChatThread({ chatId: ROOM_ID, threadId: "$root:localhost" }),
      driver.getUnread(),
    ]);

    expect(threads[0].unreadCount).toBe(0);
    expect(detail.firstUnreadIndex).toBeNull();
    expect(unread[ROOM_ID].unread).toBe(false);
  });

  it("never counts the connected user's own thread reply as unread", async () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      body: "root",
      id: "$root:localhost",
      ts: 1_000,
    });
    const mine = makeMessageEvent({
      sender: SELF_ID,
      body: "mine",
      id: "$mine:localhost",
      ts: 1_100,
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      replyToEvent: mine,
      events: [root, mine],
      length: 1,
    });
    const driver = driverWithClient(makeClient(makeRoom({ threads: [thread] })));

    const threads = await driver.getChatThreads(ROOM_ID);
    const detail = await driver.getChatThread({
      chatId: ROOM_ID,
      threadId: "$root:localhost",
    });

    expect(threads[0].unreadCount).toBe(0);
    expect(detail.firstUnreadIndex).toBeNull();
  });
});

describe("MatrixDriver read receipts", () => {
  it("marks a thread read by sending a read receipt for its last reply", async () => {
    const reply = makeMessageEvent({ sender: OTHER_ID, id: "$last:localhost" });
    const thread = makeThread({
      id: "$r:localhost",
      replyToEvent: reply,
      events: [reply],
      length: 1,
    });
    const client = makeClient(makeRoom({ threads: [thread] }));
    const driver = driverWithClient(client);

    await driver.markChatThreadRead({
      chatId: ROOM_ID,
      threadId: "$r:localhost",
    });

    expect(vi.mocked(client.sendReadReceipt)).toHaveBeenCalledWith(reply);
  });

  it("marks all threads read", async () => {
    const replyA = makeMessageEvent({ sender: OTHER_ID, id: "$la:localhost" });
    const replyB = makeMessageEvent({ sender: OTHER_ID, id: "$lb:localhost" });
    const client = makeClient(
      makeRoom({
        threads: [
          makeThread({ id: "$a", replyToEvent: replyA, length: 1 }),
          makeThread({ id: "$b", replyToEvent: replyB, length: 1 }),
        ],
      }),
    );
    const driver = driverWithClient(client);

    await driver.markAllChatThreadsRead(ROOM_ID);

    expect(vi.mocked(client.sendReadReceipt)).toHaveBeenCalledTimes(2);
  });

  it("marks a conversation read with an unthreaded receipt for its last message", async () => {
    const older = makeMessageEvent({ sender: OTHER_ID, id: "$m1:localhost" });
    const latest = makeMessageEvent({ sender: OTHER_ID, id: "$m2:localhost" });
    const client = makeClient(
      makeRoom({ timelineEvents: [older, latest] }),
    );
    const driver = driverWithClient(client);

    await driver.markChatRead(ROOM_ID);

    expect(vi.mocked(client.sendReadReceipt)).toHaveBeenCalledWith(
      latest,
      undefined,
      true,
    );
  });

  it("does not send a receipt for a conversation with no messages", async () => {
    const client = makeClient(makeRoom());
    const driver = driverWithClient(client);

    await driver.markChatRead(ROOM_ID);

    expect(vi.mocked(client.sendReadReceipt)).not.toHaveBeenCalled();
  });

  it("does not send a receipt when the conversation is already read", async () => {
    const message = makeMessageEvent({ sender: OTHER_ID, id: "$m1:localhost" });
    const client = makeClient(
      makeRoom({
        timelineEvents: [message],
        readBy: { [SELF_ID]: ["$m1:localhost"] },
      }),
    );
    const driver = driverWithClient(client);

    await driver.markChatRead(ROOM_ID);

    expect(vi.mocked(client.sendReadReceipt)).not.toHaveBeenCalled();
  });
});

describe("MatrixDriver thread composition", () => {
  it("replies in a thread via m.thread and returns the full mutation result", async () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      body: "root",
      id: "$root:localhost",
    });
    const existing = makeMessageEvent({
      sender: OTHER_ID,
      body: "r1",
      id: "$r1:localhost",
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      replyToEvent: existing,
      events: [root, existing],
      length: 1,
    });
    const client = makeClient(makeRoom({ threads: [thread] }));
    const driver = driverWithClient(client);

    const result = await driver.sendChatThreadReply({
      chatId: ROOM_ID,
      threadId: "$root:localhost",
      content: "my reply",
    });

    // The thread overload makes the SDK attach the m.thread relation.
    expect(vi.mocked(client.sendEvent)).toHaveBeenCalledWith(
      ROOM_ID,
      "$root:localhost",
      "m.room.message",
      { msgtype: "m.text", body: "my reply" },
    );
    expect(result.message).toMatchObject({
      id: SENT_EVENT_ID,
      authorId: "me",
      content: "my reply",
    });
    expect(result.rootMessage.thread).toMatchObject({
      id: "$root:localhost",
      replyCount: 2,
      unreadCount: 0,
    });
    expect(result.thread).toMatchObject({
      id: "$root:localhost",
      lastReplyPreview: "my reply",
      replyCount: 2,
      unreadCount: 0,
    });
    expect(typeof result.thread.lastReplyAt).toBe("string");
    expect(result.threadDetail.rootMessageId).toBe("$root:localhost");
    // The detail keeps the other participant's reply and appends mine — it must
    // not collapse to only the current user's messages.
    expect(result.threadDetail.messages.map((m) => m.id)).toEqual([
      "$root:localhost",
      "$r1:localhost",
      SENT_EVENT_ID,
    ]);
  });

  it("keeps other replies and excludes the pending echo on a self-rooted thread", async () => {
    // Thread rooted on the current user's own message, with another user's reply
    // plus the in-flight local echo of the reply just sent (temporary id, status
    // set). The result must contain the other reply and the real-id reply once.
    const root = makeMessageEvent({
      sender: SELF_ID,
      body: "my root",
      id: "$selfroot:localhost",
    });
    const otherReply = makeMessageEvent({
      sender: OTHER_ID,
      body: "their reply",
      id: "$other:localhost",
      ts: 1_000,
    });
    const pendingEcho = makeMessageEvent({
      sender: SELF_ID,
      body: "my reply",
      id: "~pending:localhost",
      ts: 2_000,
      status: "sending",
    });
    const thread = makeThread({
      id: "$selfroot:localhost",
      rootEvent: root,
      replyToEvent: otherReply,
      events: [root, otherReply, pendingEcho],
      length: 2,
    });
    const driver = driverWithClient(makeClient(makeRoom({ threads: [thread] })));

    const result = await driver.sendChatThreadReply({
      chatId: ROOM_ID,
      threadId: "$selfroot:localhost",
      content: "my reply",
    });

    expect(result.threadDetail.messages.map((m) => m.id)).toEqual([
      "$selfroot:localhost",
      "$other:localhost",
      SENT_EVENT_ID,
    ]);
    expect(result.thread.replyCount).toBe(2);
  });

  it("starts a thread via m.thread and returns the first-reply mutation result", async () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      body: "root",
      id: "$root2:localhost",
    });
    const client = makeClient(
      makeRoom({ eventsById: { "$root2:localhost": root } }),
    );
    const driver = driverWithClient(client);

    const result = await driver.startChatThread({
      chatId: ROOM_ID,
      rootMessageId: "$root2:localhost",
      content: "open it",
    });

    expect(vi.mocked(client.sendEvent)).toHaveBeenCalledWith(
      ROOM_ID,
      "$root2:localhost",
      "m.room.message",
      { msgtype: "m.text", body: "open it" },
    );
    expect(result.rootMessage.thread).toMatchObject({
      id: "$root2:localhost",
      replyCount: 1,
    });
    expect(result.threadDetail.messages).toHaveLength(2);
    expect(result.threadDetail.messages[1]).toMatchObject({
      id: SENT_EVENT_ID,
      content: "open it",
    });
  });
});

describe("MatrixDriver text composition", () => {
  it("reports composition as supported", () => {
    expect(new MatrixDriver().supportsComposition).toBe(true);
  });

  it("sends a text message and maps the response to a final ChatMessage", async () => {
    const client = makeClient(makeRoom());
    const driver = driverWithClient(client);

    const message = await driver.sendChatMessage({
      chatId: ROOM_ID,
      content: "hello there",
    });

    expect(vi.mocked(client.sendTextMessage)).toHaveBeenCalledWith(
      ROOM_ID,
      "hello there",
    );
    // The returned id is the REAL server event id, so the hook can replace its
    // optimistic bubble with a `/sync`-consistent message.
    expect(message).toMatchObject({
      id: SENT_EVENT_ID,
      authorId: "me",
      content: "hello there",
      reactions: [],
    });
    expect(message.timestamp).toBe(new Date(message.timestamp).toISOString());
  });

  it("rejects sending when not connected or the room is unknown", async () => {
    await expect(
      new MatrixDriver().sendChatMessage({ chatId: ROOM_ID, content: "x" }),
    ).rejects.toThrow(/not connected/);

    await expect(
      driverWithClient(makeClient(null)).sendChatMessage({
        chatId: ROOM_ID,
        content: "x",
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("MatrixDriver sync bridge mapping", () => {
  it("skips this session's own echo (in-flight or txn-tagged) so it is not duplicated", () => {
    const echoed = makeMessageEvent({
      sender: SELF_ID,
      body: "mine",
      transactionId: "m1729-1",
    });
    expect(timelineEventToChatEvent(echoed, makeRoom(), SELF_ID)).toEqual([]);

    const inFlight = makeMessageEvent({
      sender: SELF_ID,
      body: "mine",
      status: "sending",
    });
    expect(timelineEventToChatEvent(inFlight, makeRoom(), SELF_ID)).toEqual([]);
  });

  it("delivers the same user's message from another device live", () => {
    const fromOtherDevice = makeMessageEvent({
      sender: SELF_ID,
      body: "depuis Element",
      id: "$elem:localhost",
    });

    const events = timelineEventToChatEvent(
      fromOtherDevice,
      makeRoom(),
      SELF_ID,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "message:new",
      chatId: ROOM_ID,
      message: {
        id: "$elem:localhost",
        authorId: "me",
        content: "depuis Element",
      },
    });
  });

  it("emits message:new with authors for another sender", () => {
    const event = makeMessageEvent({
      sender: OTHER_ID,
      body: "hi",
      id: "$x:localhost",
    });

    const events = timelineEventToChatEvent(event, makeRoom(), SELF_ID);
    expect(events[0]).toMatchObject({
      type: "message:new",
      chatId: ROOM_ID,
      message: { id: "$x:localhost", authorId: OTHER_ID, content: "hi" },
      authors: [{ id: OTHER_ID }],
    });
  });

  it("emits message:updated targeting the edited message", () => {
    const event = makeMessageEvent({
      sender: OTHER_ID,
      body: "* edited",
      newBody: "edited",
      relation: { rel_type: "m.replace", event_id: "$target:localhost" },
    });

    const events = timelineEventToChatEvent(event, makeRoom(), SELF_ID);
    expect(events[0]).toMatchObject({
      type: "message:updated",
      chatId: ROOM_ID,
      message: { id: "$target:localhost", content: "edited" },
    });
  });

  it("leaves m.reaction timeline events to the relation bridge (no-op)", () => {
    // Reactions are owned by `onClientEvent` (the relation bridge), not the
    // timeline path, so the live mapper must emit nothing for them. The actual
    // delivery is covered by the "reaction sync bridge" tests below.
    const reactionEvent = makeMessageEvent({
      sender: OTHER_ID,
      type: "m.reaction",
      relation: {
        rel_type: "m.annotation",
        event_id: "$m1:localhost",
        key: "👍",
      },
    });

    expect(timelineEventToChatEvent(reactionEvent, makeRoom(), SELF_ID)).toEqual(
      [],
    );
  });

  it("maps another user's thread redaction to thread refresh events", () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      body: "root",
      id: "$root:localhost",
    });
    const redaction = makeMessageEvent({
      sender: OTHER_ID,
      type: "m.room.redaction",
      id: "$redaction:localhost",
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      events: [root],
      length: 0,
    });
    const room = makeRoom({
      threads: [thread],
      eventsById: { "$root:localhost": root },
    });

    const events = redactionEventToChatEvent(
      redaction,
      room,
      SELF_ID,
      "$root:localhost",
    );

    expect(events[0]).toEqual({ type: "threads:changed", chatId: ROOM_ID });
    expect(events[1]).toMatchObject({
      type: "message:updated",
      chatId: ROOM_ID,
      message: { id: "$root:localhost", thread: { id: "$root:localhost" } },
    });
  });

  it("maps a one-to-one thread reply to an unread root message update", () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      body: "root",
      id: "$root:localhost",
    });
    const reply = makeMessageEvent({
      sender: OTHER_ID,
      body: "reply",
      id: "$reply:localhost",
      threadRootId: "$root:localhost",
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      events: [root, reply],
      length: 1,
    });
    const room = makeRoom({
      threads: [thread],
      eventsById: { "$root:localhost": root },
    });

    const events = timelineEventToChatEvent(reply, room, SELF_ID);

    expect(events[0]).toEqual({ type: "threads:changed", chatId: ROOM_ID });
    expect(events[1]).toMatchObject({
      type: "message:updated",
      chatId: ROOM_ID,
      message: {
        id: "$root:localhost",
        thread: { id: "$root:localhost", unreadCount: 1 },
      },
    });
  });

  it("suppresses the connected user's own thread reply echo", () => {
    const reply = makeMessageEvent({
      sender: SELF_ID,
      body: "mine",
      threadRootId: "$root:localhost",
      transactionId: "t1",
    });

    expect(timelineEventToChatEvent(reply, makeRoom(), SELF_ID)).toEqual([]);
  });

  it("falls back to a coarse chat:changed for non-message activity", () => {
    const event = makeMessageEvent({ sender: OTHER_ID, type: "m.room.member" });

    expect(timelineEventToChatEvent(event, makeRoom(), SELF_ID)).toEqual([
      { type: "chat:changed", chatId: ROOM_ID },
    ]);
  });
});

describe("MatrixDriver reaction sync bridge", () => {
  beforeEach(() => {
    initClientMock.mockReset();
    startClientMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const reactionFromSync = (
    overrides: Partial<SeedReaction> = {},
  ): MatrixEvent =>
    makeReactionEvent("$m1:localhost", {
      key: "👍",
      sender: OTHER_ID,
      ...overrides,
    });

  it("patches the reacted message for a reaction off the live timeline", async () => {
    const { client, emitSdkEvent } = makeLiveClient(
      makeRoom({
        reactionsByEvent: {
          "$m1:localhost": [{ key: "👍", sender: OTHER_ID }],
        },
      }),
    );
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(ClientEvent.Event, reactionFromSync());

    expect(events).toEqual([
      {
        type: "reaction:updated",
        chatId: ROOM_ID,
        messageId: "$m1:localhost",
        reactions: [{ emoji: "👍", count: 1, reactedByMe: false }],
      },
    ]);
  });

  it("delivers the same user's reaction made from another device", async () => {
    const { client, emitSdkEvent } = makeLiveClient(
      makeRoom({
        reactionsByEvent: {
          "$m1:localhost": [{ key: "👍", sender: SELF_ID }],
        },
      }),
    );
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    // Same user, but no local txn id — not this session's own optimistic echo.
    emitSdkEvent(ClientEvent.Event, reactionFromSync({ sender: SELF_ID }));

    expect(events).toEqual([
      {
        type: "reaction:updated",
        chatId: ROOM_ID,
        messageId: "$m1:localhost",
        reactions: [{ emoji: "👍", count: 1, reactedByMe: true }],
      },
    ]);
  });

  it("ignores this session's own reaction echo", async () => {
    const { client, emitSdkEvent } = makeLiveClient(makeRoom());
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(
      ClientEvent.Event,
      reactionFromSync({ sender: SELF_ID, transactionId: "m-1" }),
    );

    expect(events).toEqual([]);
  });

  it("patches the reacted message when a relation redaction removes a reaction", async () => {
    const message = makeMessageEvent({
      sender: OTHER_ID,
      id: "$m1:localhost",
    });
    const reactions: SeedReaction[] = [
      { key: "👍", sender: OTHER_ID, id: "$reaction:localhost" },
    ];
    const room = makeRoom({
      timelineEvents: [message],
      eventsById: { "$m1:localhost": message },
      reactionsByEvent: { "$m1:localhost": reactions },
    });
    const { client } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    await driver.getChatMessages({ chatId: ROOM_ID });
    reactions[0].redacted = true;
    const relations = (
      room.relations as unknown as {
        getChildEventsForEvent: (eventId: string) => TestRelations | undefined;
      }
    ).getChildEventsForEvent("$m1:localhost");

    relations?.emitRedaction(
      makeReactionEvent("$m1:localhost", reactions[0]),
    );

    expect(events).toEqual([
      {
        type: "reaction:updated",
        chatId: ROOM_ID,
        messageId: "$m1:localhost",
        reactions: [],
      },
    ]);
  });

  it("patches a reaction on a thread reply in the thread detail cache", async () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      id: "$root:localhost",
    });
    const reply = makeMessageEvent({
      sender: OTHER_ID,
      id: "$tm:localhost",
      threadRootId: "$root:localhost",
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      events: [root, reply],
      length: 1,
      timelineSetRelations: {
        "$tm:localhost": [{ key: "🎉", sender: OTHER_ID }],
      },
    });
    const { client, emitSdkEvent } = makeLiveClient(
      makeRoom({
        threads: [thread],
        eventsById: { "$root:localhost": root, "$tm:localhost": reply },
      }),
    );
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(
      ClientEvent.Event,
      makeReactionEvent("$tm:localhost", { key: "🎉", sender: OTHER_ID }),
    );

    expect(events).toEqual([
      {
        type: "reaction:updated",
        chatId: ROOM_ID,
        messageId: "$tm:localhost",
        reactions: [{ emoji: "🎉", count: 1, reactedByMe: false }],
      },
      {
        type: "reaction:updated",
        chatId: ROOM_ID,
        messageId: "$tm:localhost",
        reactions: [{ emoji: "🎉", count: 1, reactedByMe: false }],
        threadId: "$root:localhost",
      },
    ]);
  });

  it("patches both main timeline and thread detail for a thread-root reaction", async () => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      id: "$root:localhost",
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      events: [root],
      length: 0,
    });
    const { client, emitSdkEvent } = makeLiveClient(
      makeRoom({
        threads: [thread],
        eventsById: { "$root:localhost": root },
        reactionsByEvent: {
          "$root:localhost": [{ key: "👍", sender: OTHER_ID }],
        },
      }),
    );
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(
      ClientEvent.Event,
      makeReactionEvent("$root:localhost", { key: "👍", sender: OTHER_ID }),
    );

    expect(events).toEqual([
      {
        type: "reaction:updated",
        chatId: ROOM_ID,
        messageId: "$root:localhost",
        reactions: [{ emoji: "👍", count: 1, reactedByMe: false }],
      },
      {
        type: "reaction:updated",
        chatId: ROOM_ID,
        messageId: "$root:localhost",
        reactions: [{ emoji: "👍", count: 1, reactedByMe: false }],
        threadId: "$root:localhost",
      },
    ]);
  });

  it("does not re-handle a reaction from the timeline path", async () => {
    const room = makeRoom();
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(RoomEvent.Timeline, reactionFromSync(), room, false);

    expect(events).not.toContainEqual({ type: "chat:changed", chatId: ROOM_ID });
    expect(
      events.every(
        (event) => (event as { type: string }).type !== "reaction:updated",
      ),
    ).toBe(true);
  });

  it("delivers an un-reaction redacted by the same user from another device", async () => {
    const room = makeRoom();
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    // Same user, no txn id — not this session's echo, so the un-reaction refreshes.
    const redaction = makeMessageEvent({
      sender: SELF_ID,
      type: "m.room.redaction",
      id: "$red:localhost",
    });
    emitSdkEvent(RoomEvent.Redaction, redaction, room);

    expect(events).toContainEqual({ type: "chat:changed", chatId: ROOM_ID });
  });

  it("detaches the reaction listener on teardown", async () => {
    const { client, off } = makeLiveClient(makeRoom());
    const driver = await bootstrapDriverWithClient(client);

    (driver as unknown as { detachSync: () => void }).detachSync();

    expect(off).toHaveBeenCalledWith(ClientEvent.Event, expect.any(Function));
  });
});

describe("MatrixDriver SDK thread bridge", () => {
  beforeEach(() => {
    initClientMock.mockReset();
    startClientMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const makeLiveThread = (opts: { withRoot?: boolean } = {}) => {
    const root =
      opts.withRoot === false
        ? undefined
        : makeMessageEvent({
            sender: OTHER_ID,
            body: "root",
            id: "$root:localhost",
          });
    const reply = makeMessageEvent({
      sender: OTHER_ID,
      body: "reply",
      id: "$reply:localhost",
      threadRootId: "$root:localhost",
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      replyToEvent: reply,
      events: root ? [root, reply] : [reply],
      length: 1,
    });
    const room = makeRoom({
      threads: [thread],
      ...(root ? { eventsById: { "$root:localhost": root } } : {}),
    });
    attachThreadRoom(thread, room);
    return { room, thread };
  };

  it("refreshes threads, root summary and unread on a live ThreadEvent.New", async () => {
    const { room, thread } = makeLiveThread();
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(ThreadEvent.New, thread, false);

    expect(events).toEqual([
      { type: "threads:changed", chatId: ROOM_ID },
      expect.objectContaining({
        type: "message:updated",
        chatId: ROOM_ID,
        message: expect.objectContaining({
          id: "$root:localhost",
          thread: { id: "$root:localhost", replyCount: 1, unreadCount: 1 },
        }),
      }),
      {
        type: "unread:changed",
        chatId: ROOM_ID,
        unread: { unread: true, highlight: false },
      },
    ]);
  });

  it("ignores ThreadEvent.New from backward pagination", async () => {
    const { room, thread } = makeLiveThread();
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(ThreadEvent.New, thread, true);

    expect(events).toEqual([]);
  });

  it("refreshes threads, root summary and unread on ThreadEvent.Update", async () => {
    const { room, thread } = makeLiveThread();
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(ThreadEvent.Update, thread);

    expect(events).toEqual([
      { type: "threads:changed", chatId: ROOM_ID },
      expect.objectContaining({
        type: "message:updated",
        chatId: ROOM_ID,
        message: expect.objectContaining({
          id: "$root:localhost",
          thread: { id: "$root:localhost", replyCount: 1, unreadCount: 1 },
        }),
      }),
      {
        type: "unread:changed",
        chatId: ROOM_ID,
        unread: { unread: true, highlight: false },
      },
    ]);
  });

  it("still refreshes threads and unread when the SDK thread has no root event yet", async () => {
    const { room, thread } = makeLiveThread({ withRoot: false });
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(ThreadEvent.Update, thread);

    expect(events).toEqual([
      { type: "threads:changed", chatId: ROOM_ID },
      {
        type: "unread:changed",
        chatId: ROOM_ID,
        unread: { unread: true, highlight: false },
      },
    ]);
  });
});

describe("MatrixDriver receipt & sync bridge", () => {
  beforeEach(() => {
    initClientMock.mockReset();
    startClientMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A room with one thread whose single reply is from the counterpart. */
  const makeRoomWithThread = (opts: { read?: boolean } = {}) => {
    const root = makeMessageEvent({
      sender: OTHER_ID,
      body: "root",
      id: "$root:localhost",
    });
    const reply = makeMessageEvent({
      sender: OTHER_ID,
      body: "reply",
      id: "$reply:localhost",
      threadRootId: "$root:localhost",
    });
    const thread = makeThread({
      id: "$root:localhost",
      rootEvent: root,
      replyToEvent: reply,
      events: [root, reply],
      length: 1,
      ...(opts.read ? { readBy: { [SELF_ID]: ["$reply:localhost"] } } : {}),
    });
    const room = makeRoom({
      threads: [thread],
      eventsById: { "$root:localhost": root },
    });
    attachThreadRoom(thread, room);
    return { room, thread };
  };

  /** A receipt event whose content marks `userId`'s `m.read` on the last reply. */
  const makeReceiptEvent = (userId: string): MatrixEvent =>
    ({
      getContent: () => ({
        "$reply:localhost": { "m.read": { [userId]: { ts: 1 } } },
      }),
    }) as unknown as MatrixEvent;

  it("re-emits the thread bundle on the connected user's own read receipt", async () => {
    const { room } = makeRoomWithThread();
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(RoomEvent.Receipt, makeReceiptEvent(SELF_ID), room);

    expect(events).toEqual([
      {
        type: "unread:changed",
        chatId: ROOM_ID,
        unread: { unread: true, highlight: false },
      },
      { type: "threads:changed", chatId: ROOM_ID },
      expect.objectContaining({
        type: "message:updated",
        chatId: ROOM_ID,
        message: expect.objectContaining({
          id: "$root:localhost",
          thread: { id: "$root:localhost", replyCount: 1, unreadCount: 1 },
        }),
      }),
    ]);
  });

  it("clears the thread badge when the receipt marks the reply read (cross-session)", async () => {
    const { room } = makeRoomWithThread({ read: true });
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(RoomEvent.Receipt, makeReceiptEvent(SELF_ID), room);

    expect(events).toEqual([
      {
        type: "unread:changed",
        chatId: ROOM_ID,
        unread: { unread: false, highlight: false },
      },
      { type: "threads:changed", chatId: ROOM_ID },
      expect.objectContaining({
        type: "message:updated",
        chatId: ROOM_ID,
        message: expect.objectContaining({
          id: "$root:localhost",
          thread: { id: "$root:localhost", replyCount: 1, unreadCount: 0 },
        }),
      }),
    ]);
  });

  it("ignores a receipt that is not the connected user's", async () => {
    const { room } = makeRoomWithThread();
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(RoomEvent.Receipt, makeReceiptEvent(OTHER_ID), room);

    expect(events).toEqual([]);
  });

  it("emits only unread on a receipt in a thread-less conversation", async () => {
    const room = makeRoom();
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(RoomEvent.Receipt, makeReceiptEvent(SELF_ID), room);

    expect(events).toEqual([
      {
        type: "unread:changed",
        chatId: ROOM_ID,
        unread: { unread: false, highlight: false },
      },
    ]);
  });

  it("forces a coarse re-read on the first live network sync", async () => {
    const { room } = makeRoomWithThread();
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(ClientEvent.Sync, SyncState.Syncing, SyncState.Prepared, {
      fromCache: false,
    });

    expect(events).toEqual([
      { type: "chat:changed", chatId: ROOM_ID },
      {
        type: "unread:changed",
        chatId: ROOM_ID,
        unread: { unread: true, highlight: false },
      },
      { type: "threads:changed", chatId: ROOM_ID },
      expect.objectContaining({
        type: "message:updated",
        chatId: ROOM_ID,
        message: expect.objectContaining({ id: "$root:localhost" }),
      }),
      { type: "chats:changed" },
    ]);
  });

  it("ignores the cache-sourced PREPARED and steady-state polling", async () => {
    const { room } = makeRoomWithThread();
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    // Warm-start PREPARED comes from the IndexedDB cache — no re-read.
    emitSdkEvent(ClientEvent.Sync, SyncState.Prepared, null, {
      fromCache: true,
    });
    // Steady-state long-poll return — no re-read.
    emitSdkEvent(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing, {
      fromCache: false,
    });

    expect(events).toEqual([]);
  });

  it("re-reads on reconnect (Catchup → Syncing)", async () => {
    const { room } = makeRoomWithThread();
    const { client, emitSdkEvent } = makeLiveClient(room);
    const driver = await bootstrapDriverWithClient(client);
    const events: unknown[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    emitSdkEvent(ClientEvent.Sync, SyncState.Syncing, SyncState.Catchup, undefined);

    const types = events.map((event) => (event as { type: string }).type);
    expect(types).toContain("chat:changed");
    expect(types).toContain("chats:changed");
  });
});

describe("MatrixDriver discovery seam", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Reaches the private discovery method, the seam routed from settings. */
  const discover = (driver: MatrixDriver, hint: string) =>
    (
      driver as unknown as {
        discoverHomeserver: (
          h: string,
        ) => Promise<{ base_url: string; server_name: string }>;
      }
    ).discoverHomeserver(hint);

  it("uses the configured base URL for `fixed` discovery, with no lookup", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const driver = new MatrixDriver("matrix-local", {
      discovery: "fixed",
      baseUrl: "http://localhost:9808",
      serverName: "localhost",
    });

    const homeserver = await discover(driver, "hub");

    expect(homeserver).toEqual({
      base_url: "http://localhost:9808",
      server_name: "localhost",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("performs the Tchap identity-server lookup for `tchap-email` discovery", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hs: "dev01.tchap.incubateur.net" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const driver = new MatrixDriver("matrix-dev", {});

    const homeserver = await discover(driver, "marc3@tchap.beta.gouv.fr");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://matrix.dev01.tchap.incubateur.net/_matrix/identity/api/v1/info?medium=email&address=marc3%40tchap.beta.gouv.fr",
    );
    expect(homeserver.base_url).toBe(
      "https://matrix.dev01.tchap.incubateur.net",
    );
  });
});

describe("MatrixDriver local Matrix sessions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const makeStorage = (): Storage => {
    const values = new Map<string, string>();
    return {
      get length() {
        return values.size;
      },
      clear: vi.fn(() => values.clear()),
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      key: vi.fn((index: number) => [...values.keys()][index] ?? null),
      removeItem: vi.fn((key: string) => values.delete(key)),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
    };
  };

  const setStorageOwner = (
    driver: MatrixDriver,
    user: { email?: string } | null,
  ) => {
    (
      driver as unknown as {
        setStorageOwner: (u: { email?: string } | null) => void;
      }
    ).setStorageOwner(user);
  };

  const driverStorageKey = (driver: MatrixDriver, key: string) =>
    (
      driver as unknown as {
        key: (k: string) => string;
      }
    ).key(key);

  const cryptoStoreDbName = (
    driver: MatrixDriver,
    user: { mxId: string; deviceId?: string },
  ) =>
    (
      driver as unknown as {
        cryptoStoreDbName: (u: { mxId: string; deviceId?: string }) => string;
      }
    ).cryptoStoreDbName(user);

  it("scopes stored Matrix sessions by the resolved login hint", () => {
    vi.stubGlobal("localStorage", makeStorage());
    vi.stubGlobal("sessionStorage", makeStorage());
    const driver = new MatrixDriver("matrix-local", {
      discovery: "fixed",
      baseUrl: "http://localhost:9808",
      serverName: "localhost",
    });

    setStorageOwner(driver, { email: "user.test@chromium.test" });
    expect(driverStorageKey(driver, "matrixUser")).toBe(
      "matrixUser:user.test@chromium.test:matrix-local",
    );

    setStorageOwner(driver, { email: "user.test@webkit.test" });
    expect(driverStorageKey(driver, "matrixUser")).toBe(
      "matrixUser:user.test@webkit.test:matrix-local",
    );
  });

  it("isolates the crypto store per Matrix user and device", () => {
    const driver = new MatrixDriver("matrix-local", {
      discovery: "fixed",
      baseUrl: "http://localhost:9808",
      serverName: "localhost",
    });

    expect(
      cryptoStoreDbName(driver, {
        mxId: "@hub:localhost",
        deviceId: "first-device",
      }),
    ).toBe("crypto-store:@hub:localhost:first-device:matrix-local");
    expect(
      cryptoStoreDbName(driver, {
        mxId: "@hub:localhost",
        deviceId: "second-device",
      }),
    ).toBe("crypto-store:@hub:localhost:second-device:matrix-local");
  });

  it("auto-joins invited rooms surfaced by the Matrix sync", async () => {
    const inviteRoom = {
      roomId: "!invite:localhost",
      getMyMembership: () => KnownMembership.Invite,
    } as unknown as Room;
    const joinedRoom = {
      roomId: "!joined:localhost",
      getMyMembership: () => KnownMembership.Join,
    } as unknown as Room;
    const joinRoom = vi.fn(async () => ({}));
    const mx = {
      getRooms: () => [inviteRoom, joinedRoom],
      joinRoom,
    } as unknown as MatrixClient;
    const events: unknown[] = [];
    const driver = new MatrixDriver("matrix-local", { autoJoinInvites: true });
    driver.subscribeToEvents((event) => events.push(event));

    await (
      driver as unknown as {
        joinInvitedRooms: (client: MatrixClient) => Promise<void>;
      }
    ).joinInvitedRooms(mx);

    expect(joinRoom).toHaveBeenCalledTimes(1);
    expect(joinRoom).toHaveBeenCalledWith("!invite:localhost");
    expect(events).toEqual([{ type: "chats:changed" }]);
  });
});

describe("MatrixDriver render safety", () => {
  it("never throws from a read when the client knows the room", async () => {
    const driver = driverWithClient(makeClient(makeRoom()));

    await expect(driver.getChat(ROOM_ID)).resolves.toBeDefined();
    await expect(
      driver.getChatMessages({ chatId: ROOM_ID }),
    ).resolves.toBeDefined();
    await expect(driver.getChatThreads(ROOM_ID)).resolves.toEqual([]);
    await expect(driver.getChatDocuments()).resolves.toBeDefined();
  });
});
