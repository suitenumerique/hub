// @vitest-environment jsdom
import {
  KnownMembership,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  type Thread,
} from "matrix-js-sdk/lib/matrix";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { timelineEventToChatEvent } from "../matrixEventMapping";
import { MatrixDriver } from "../MatrixDriver";
import { readChatSelfPresencePreference } from "../../presencePreference";
import { MEETING_EVENT_TYPE } from "../matrixMeetingMapping";
import { MeetingNotAllowedError } from "../../meetingErrors";
import {
  matrixJoinedRoomToLocalChat,
  MATRIX_FAVOURITE_TAG,
} from "../matrixRoomMapping";

// These unit tests cover only the pure real-time mapping and the send/reaction
// paths that are cheap to assert without a live server.

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

type SeedReaction = {
  key: string;
  sender: string;
  id?: string;
};

const makeReactionEvent = (
  targetId: string,
  reaction: SeedReaction,
): MatrixEvent =>
  ({
    getType: () => "m.reaction",
    isRedacted: () => false,
    getId: () => reaction.id ?? `$reaction-${reaction.sender}`,
    getSender: () => reaction.sender,
    getRelation: () => ({
      rel_type: "m.annotation",
      event_id: targetId,
      key: reaction.key,
    }),
  }) as unknown as MatrixEvent;

/** A timeline event shaped just enough for the mapper under test. */
const makeMessageEvent = (opts: {
  sender: string;
  body?: string;
  id?: string;
  type?: string;
  threadRootId?: string;
  isThreadRoot?: boolean;
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
    getTs: () => 1_700_000_000_000,
    threadRootId: opts.threadRootId,
    isThreadRoot: opts.isThreadRoot ?? false,
    status: opts.status ?? null,
    getContent: () => ({
      body: opts.body ?? "",
      ...(opts.newBody ? { "m.new_content": { body: opts.newBody } } : {}),
    }),
    getRelation: () => opts.relation ?? null,
    replacingEventId: () => undefined,
    getUnsigned: () =>
      opts.transactionId ? { transaction_id: opts.transactionId } : {},
    getTxnId: () => opts.txnId,
  }) as unknown as MatrixEvent;

const makeRoom = (
  reactionsByEvent: Record<string, SeedReaction[]> = {},
  eventsById: Record<string, MatrixEvent> = {},
  threadsById: Record<string, Thread> = {},
): Room =>
  ({
    roomId: ROOM_ID,
    getMember: (id: string) => ({ name: id === SELF_ID ? "Me" : id }),
    currentState: { maySendRedactionForEvent: () => false },
    getThread: (threadId: string) => threadsById[threadId] ?? null,
    findEventById: (eventId: string) => eventsById[eventId],
    relations: {
      getChildEventsForEvent: (eventId: string) => {
        const reactions = reactionsByEvent[eventId];
        return reactions
          ? {
              getRelations: () =>
                reactions.map((reaction) =>
                  makeReactionEvent(eventId, reaction),
                ),
            }
          : undefined;
      },
    },
  }) as unknown as Room;

const makeThread = (
  threadId: string,
  eventsById: Record<string, MatrixEvent>,
): Thread =>
  ({
    id: threadId,
    rootEvent: eventsById[threadId],
    findEventById: (eventId: string) => eventsById[eventId],
    timelineSet: {
      relations: { getChildEventsForEvent: () => undefined },
    },
  }) as unknown as Thread;

/** Injects a live client without driving the OIDC/`connect` flow. */
const driverWithClient = (mx: MatrixClient | null): MatrixDriver => {
  const driver = new MatrixDriver();
  (driver as unknown as { mx: MatrixClient | null }).mx = mx;
  return driver;
};

beforeEach(() => {
  localStorage.clear();
  startClientMock.mockReset();
  startClientMock.mockResolvedValue(undefined);
});

describe("MatrixDriver.getUserPresence", () => {
  it("reads the current presence from the Matrix client store", () => {
    const getUser = vi.fn((userId: string) =>
      userId === OTHER_ID
        ? {
            userId: OTHER_ID,
            events: {
              presence: { getContent: () => ({ presence: "online" }) },
            },
          }
        : null,
    );
    const mx = { getUser } as unknown as MatrixClient;

    expect(driverWithClient(mx).getUserPresence(OTHER_ID)).toEqual({
      userId: OTHER_ID,
      state: "online",
    });
    expect(getUser).toHaveBeenCalledWith(OTHER_ID);
  });

  it("returns null without a connected client or known user", () => {
    expect(driverWithClient(null).getUserPresence(OTHER_ID)).toBeNull();
    expect(
      driverWithClient({
        getUser: () => null,
      } as unknown as MatrixClient).getUserPresence(OTHER_ID),
    ).toBeNull();
  });
});

describe("MatrixDriver.setUserPresence", () => {
  it.each(["online", "unavailable", "offline"] as const)(
    "makes Matrix %s authoritative for subsequent syncs",
    async (state) => {
      const setSyncPresence = vi.fn().mockResolvedValue(undefined);
      const setPresence = vi.fn().mockResolvedValue(undefined);
      const mx = {
        getUserId: () => OTHER_ID,
        setSyncPresence,
        setPresence,
      } as unknown as MatrixClient;
      const driver = driverWithClient(mx);

      expect(driver.getCurrentUserId()).toBe(OTHER_ID);
      await driver.setUserPresence(state);

      expect(setSyncPresence).toHaveBeenCalledWith(state);
      expect(setPresence).not.toHaveBeenCalled();
    },
  );

  it("deduplicates an unchanged effective state", async () => {
    const setSyncPresence = vi.fn().mockResolvedValue(undefined);
    const driver = driverWithClient({
      setSyncPresence,
    } as unknown as MatrixClient);

    await driver.setUserPresence("online");
    await driver.setUserPresence("online");

    expect(setSyncPresence.mock.calls).toEqual([["online"]]);
  });

  it("rejects a non-standard busy state before calling the SDK", async () => {
    const setSyncPresence = vi.fn().mockResolvedValue(undefined);
    const setPresence = vi.fn().mockResolvedValue(undefined);
    const driver = driverWithClient({
      setSyncPresence,
      setPresence,
    } as unknown as MatrixClient);

    await expect(driver.setUserPresence("busy" as never)).rejects.toThrowError(
      'invalid state "busy"',
    );
    expect(setSyncPresence).not.toHaveBeenCalled();
    expect(setPresence).not.toHaveBeenCalled();
  });

  it("rejects when the Matrix account is not connected", async () => {
    const driver = driverWithClient(null);

    expect(driver.getCurrentUserId()).toBeNull();
    await expect(driver.setUserPresence("online")).rejects.toThrowError(
      "client is not connected",
    );
  });
});

describe("MatrixDriver self-presence preference", () => {
  it.each(["online", "offline"] as const)(
    "persists and applies the manual %s preference",
    async (preference) => {
      const setSyncPresence = vi.fn().mockResolvedValue(undefined);
      const setPresence = vi.fn().mockResolvedValue(undefined);
      const driver = driverWithClient({
        setSyncPresence,
        setPresence,
      } as unknown as MatrixClient);

      await driver.setSelfPresencePreference(preference);

      expect(readChatSelfPresencePreference("matrix-local")).toBe(preference);
      expect(setSyncPresence).toHaveBeenCalledWith(preference);
      expect(setPresence).toHaveBeenCalledWith({ presence: preference });
    },
  );

  it("keeps the sync intention and preference when the immediate PUT fails", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const setSyncPresence = vi.fn().mockResolvedValue(undefined);
    const setPresence = vi.fn().mockRejectedValue(new Error("rate limited"));
    const driver = driverWithClient({
      setSyncPresence,
      setPresence,
    } as unknown as MatrixClient);

    await expect(
      driver.setSelfPresencePreference("offline"),
    ).resolves.toBeUndefined();

    expect(setSyncPresence.mock.calls).toEqual([["offline"]]);
    expect(readChatSelfPresencePreference("matrix-local")).toBe("offline");
    expect(consoleInfo).toHaveBeenCalledOnce();
    consoleInfo.mockRestore();
  });
});

describe("timelineEventToChatEvent (real-time sync mapping)", () => {
  it("keeps a thread root on the main timeline", () => {
    const event = makeMessageEvent({
      sender: OTHER_ID,
      body: "hi",
      id: "$x:localhost",
      threadRootId: "$x:localhost",
      isThreadRoot: true,
    });

    expect(timelineEventToChatEvent(event, makeRoom(), SELF_ID)).toEqual([
      {
        type: "message:new",
        chatId: ROOM_ID,
        message: expect.objectContaining({
          id: "$x:localhost",
          authorId: OTHER_ID,
          content: "hi",
        }),
        authors: [expect.objectContaining({ id: OTHER_ID })],
      },
    ]);
  });

  it("delivers the same user's message from another device live", () => {
    const event = makeMessageEvent({
      sender: SELF_ID,
      body: "from Element",
      id: "$elem:localhost",
    });

    expect(
      timelineEventToChatEvent(event, makeRoom(), SELF_ID)[0],
    ).toMatchObject({
      type: "message:new",
      message: { id: "$elem:localhost", authorId: "me" },
    });
  });

  it("suppresses this session's own echo so it is not duplicated", () => {
    const txnTagged = makeMessageEvent({
      sender: SELF_ID,
      body: "mine",
      transactionId: "m1729-1",
    });
    const inFlight = makeMessageEvent({
      sender: SELF_ID,
      body: "mine",
      status: "sending",
    });

    expect(timelineEventToChatEvent(txnTagged, makeRoom(), SELF_ID)).toEqual(
      [],
    );
    expect(timelineEventToChatEvent(inFlight, makeRoom(), SELF_ID)).toEqual([]);
  });

  it("maps an edit (m.replace) to message:updated on the target", () => {
    const targetId = "$target:localhost";
    const original = makeMessageEvent({
      sender: OTHER_ID,
      body: "before",
      id: targetId,
    });
    const event = makeMessageEvent({
      sender: OTHER_ID,
      body: "* edited",
      newBody: "edited",
      relation: { rel_type: "m.replace", event_id: targetId },
    });

    expect(
      timelineEventToChatEvent(
        event,
        makeRoom({}, { [targetId]: original }),
        SELF_ID,
      )[0],
    ).toMatchObject({
      type: "message:updated",
      chatId: ROOM_ID,
      message: { id: targetId, content: "edited" },
    });
  });

  it("ignores an m.replace event sent by somebody other than the author", () => {
    const targetId = "$target:localhost";
    const original = makeMessageEvent({
      sender: OTHER_ID,
      body: "untouched",
      id: targetId,
    });
    const forgedEdit = makeMessageEvent({
      sender: SELF_ID,
      body: "* forged",
      newBody: "forged",
      relation: { rel_type: "m.replace", event_id: targetId },
    });

    expect(
      timelineEventToChatEvent(
        forgedEdit,
        makeRoom({}, { [targetId]: original }),
        SELF_ID,
      ),
    ).toEqual([]);
  });

  it("maps message annotations and live reactions to the generic shape", () => {
    const targetId = "$target:localhost";
    const reactions = {
      [targetId]: [
        { key: "👍", sender: SELF_ID },
        { key: "👍", sender: OTHER_ID },
        { key: "👍", sender: OTHER_ID, id: "$duplicate:localhost" },
      ],
    };
    const room = makeRoom(reactions);
    const message = makeMessageEvent({
      sender: OTHER_ID,
      id: targetId,
      body: "hello",
    });
    const reaction = makeMessageEvent({
      sender: OTHER_ID,
      type: "m.reaction",
      relation: {
        rel_type: "m.annotation",
        event_id: targetId,
        key: "👍",
      },
    });

    expect(timelineEventToChatEvent(message, room, SELF_ID)[0]).toMatchObject({
      type: "message:new",
      message: {
        id: targetId,
        reactions: [{ emoji: "👍", count: 2, reactedByMe: true }],
      },
    });
    expect(timelineEventToChatEvent(reaction, room, SELF_ID)).toEqual([
      {
        type: "reaction:updated",
        chatId: ROOM_ID,
        messageId: targetId,
        reactions: [{ emoji: "👍", count: 2, reactedByMe: true }],
      },
    ]);
  });

  it("refreshes threads without appending replies to the main timeline", () => {
    const threadReply = makeMessageEvent({
      sender: OTHER_ID,
      body: "reply",
      threadRootId: "$root:localhost",
    });
    const member = makeMessageEvent({
      sender: OTHER_ID,
      type: "m.room.member",
    });

    expect(timelineEventToChatEvent(threadReply, makeRoom(), SELF_ID)).toEqual([
      { type: "threads:changed", chatId: ROOM_ID },
    ]);
    expect(timelineEventToChatEvent(member, makeRoom(), SELF_ID)).toEqual([
      { type: "chat:changed", chatId: ROOM_ID },
    ]);
  });
});

describe("MatrixDriver.sendChatMessage", () => {
  it("sends the text and returns the message under the real server id", async () => {
    const room = makeRoom();
    const sendTextMessage = vi.fn(async () => ({ event_id: SENT_EVENT_ID }));
    const mx = {
      getRoom: (id: string) => (id === ROOM_ID ? room : null),
      sendTextMessage,
    } as unknown as MatrixClient;

    const message = await driverWithClient(mx).sendChatMessage({
      chatId: ROOM_ID,
      content: "bonjour",
    });

    expect(sendTextMessage).toHaveBeenCalledWith(ROOM_ID, "bonjour");
    expect(message).toMatchObject({
      id: SENT_EVENT_ID,
      authorId: "me",
      content: "bonjour",
    });
  });

  it("throws when the client is not connected", async () => {
    await expect(
      driverWithClient(null).sendChatMessage({
        chatId: ROOM_ID,
        content: "x",
      }),
    ).rejects.toThrow(/not connected/);
  });
});

describe("MatrixDriver room metadata", () => {
  it("maps m.favourite to the favourites section", () => {
    const room = {
      roomId: ROOM_ID,
      tags: { [MATRIX_FAVOURITE_TAG]: {} },
      getMembers: () => [
        {
          userId: OTHER_ID,
          name: "Alice",
          membership: KnownMembership.Join,
          getMxcAvatarUrl: () => undefined,
        },
      ],
      getLastActiveTimestamp: () => 0,
      currentState: { getStateEvents: () => undefined },
      getLiveTimeline: () => ({ getEvents: () => [] }),
      getMxcAvatarUrl: () => null,
    } as unknown as Room;

    expect(matrixJoinedRoomToLocalChat(room, SELF_ID).section).toBe(
      "favourites",
    );
  });

  it("sets and deletes the Matrix favourite tag", async () => {
    const room = {
      roomId: ROOM_ID,
      tags: {},
    } as unknown as Room;
    const setRoomTag = vi.fn(async () => ({}));
    const deleteRoomTag = vi.fn(async () => ({}));
    const mx = {
      getRoom: () => room,
      getJoinedRooms: async () => ({ joined_rooms: [ROOM_ID] }),
      setRoomTag,
      deleteRoomTag,
    } as unknown as MatrixClient;
    const driver = driverWithClient(mx);

    await driver.setChatFavourite(ROOM_ID, true);
    expect(setRoomTag).toHaveBeenCalledWith(ROOM_ID, MATRIX_FAVOURITE_TAG, {});

    room.tags[MATRIX_FAVOURITE_TAG] = {};
    await driver.setChatFavourite(ROOM_ID, false);
    expect(deleteRoomTag).toHaveBeenCalledWith(ROOM_ID, MATRIX_FAVOURITE_TAG);
  });

  it("hydrates and splits joined and invited room members", async () => {
    const loadMembersIfNeeded = vi.fn(async () => true);
    const room = {
      roomId: ROOM_ID,
      loadMembersIfNeeded,
      getMembers: () => [
        {
          userId: OTHER_ID,
          name: "Alice",
          membership: KnownMembership.Join,
        },
        {
          userId: SELF_ID,
          name: "Me",
          membership: KnownMembership.Join,
        },
        {
          userId: "@bob:localhost",
          name: "Bob",
          membership: KnownMembership.Invite,
        },
        {
          userId: "@left:localhost",
          name: "Left",
          membership: KnownMembership.Leave,
        },
      ],
    } as unknown as Room;
    const mx = {
      getRoom: () => room,
      getUserId: () => SELF_ID,
      getJoinedRooms: async () => ({ joined_rooms: [ROOM_ID] }),
    } as unknown as MatrixClient;

    const members = await driverWithClient(mx).getChatMembers(ROOM_ID);

    expect(loadMembersIfNeeded).toHaveBeenCalledOnce();
    expect(members.present.map((member) => member.id)).toEqual([
      SELF_ID,
      OTHER_ID,
    ]);
    expect(members.pendingInvites.map((member) => member.id)).toEqual([
      "@bob:localhost",
    ]);
  });
});

describe("MatrixDriver.toggleChatReaction", () => {
  it("sends an annotation when the current user has not reacted", async () => {
    const messageId = "$message:localhost";
    const message = makeMessageEvent({ sender: OTHER_ID, id: messageId });
    // The SDK relation cache may retain a redacted local echo. The empty
    // server response remains authoritative and must take the add branch.
    const room = makeRoom(
      {
        [messageId]: [{ key: "👍", sender: SELF_ID, id: "$stale:localhost" }],
      },
      { [messageId]: message },
    );
    const sendEvent = vi.fn(async () => ({ event_id: "$reaction:localhost" }));
    const redactEvent = vi.fn();
    const mx = {
      getRoom: () => room,
      getUserId: () => SELF_ID,
      relations: vi.fn(async () => ({ events: [] })),
      sendEvent,
      redactEvent,
    } as unknown as MatrixClient;

    const updated = await driverWithClient(mx).toggleChatReaction({
      chatId: ROOM_ID,
      messageId,
      emoji: "👍",
    });

    expect(sendEvent).toHaveBeenCalledWith(ROOM_ID, "m.reaction", {
      "m.relates_to": {
        rel_type: "m.annotation",
        event_id: messageId,
        key: "👍",
      },
    });
    expect(redactEvent).not.toHaveBeenCalled();
    expect(updated.reactions).toEqual([
      { emoji: "👍", count: 1, reactedByMe: true },
    ]);
  });

  it("redacts the current user's existing annotation", async () => {
    const messageId = "$message:localhost";
    const reactionId = "$own-reaction:localhost";
    const message = makeMessageEvent({ sender: OTHER_ID, id: messageId });
    const room = makeRoom(
      {
        [messageId]: [{ key: "👍", sender: SELF_ID, id: reactionId }],
      },
      { [messageId]: message },
    );
    const redactEvent = vi.fn(async () => ({ event_id: "$redaction" }));
    const ownReaction = makeReactionEvent(messageId, {
      key: "👍",
      sender: SELF_ID,
      id: reactionId,
    });
    const mx = {
      getRoom: () => room,
      getUserId: () => SELF_ID,
      relations: vi.fn(async () => ({ events: [ownReaction] })),
      redactEvent,
    } as unknown as MatrixClient;

    const updated = await driverWithClient(mx).toggleChatReaction({
      chatId: ROOM_ID,
      messageId,
      emoji: "👍",
    });

    expect(redactEvent).toHaveBeenCalledWith(ROOM_ID, reactionId);
    expect(updated.reactions).toEqual([]);
  });

  it("sends a thread-scoped annotation for a reply", async () => {
    const threadId = "$thread:localhost";
    const messageId = "$reply:localhost";
    const root = makeMessageEvent({
      sender: OTHER_ID,
      id: threadId,
      threadRootId: threadId,
      isThreadRoot: true,
    });
    const reply = makeMessageEvent({
      sender: OTHER_ID,
      id: messageId,
      threadRootId: threadId,
    });
    const events = { [threadId]: root, [messageId]: reply };
    const thread = makeThread(threadId, events);
    const room = makeRoom({}, events, { [threadId]: thread });
    const sendEvent = vi.fn(async () => ({ event_id: "$reaction:localhost" }));
    const mx = {
      getRoom: () => room,
      getUserId: () => SELF_ID,
      relations: vi.fn(async () => ({ events: [] })),
      sendEvent,
    } as unknown as MatrixClient;

    const updated = await driverWithClient(mx).toggleChatThreadReaction({
      chatId: ROOM_ID,
      threadId,
      messageId,
      emoji: "👍",
    });

    expect(sendEvent).toHaveBeenCalledWith(ROOM_ID, threadId, "m.reaction", {
      "m.relates_to": {
        rel_type: "m.annotation",
        event_id: messageId,
        key: "👍",
      },
    });
    expect(updated.reactions).toEqual([
      { emoji: "👍", count: 1, reactedByMe: true },
    ]);
  });
});

describe("MatrixDriver.startChatMeeting", () => {
  const MEET_ROOM = {
    slug: "abc-defg-hij",
    url: "https://meet.example.com/abc-defg-hij",
  };

  const makeMeetingRoom = (
    stateEvents: MatrixEvent[] = [],
    mayRecordMeeting = true,
  ): Room =>
    ({
      roomId: ROOM_ID,
      currentState: {
        getStateEvents: (_type: string, stateKey?: string) =>
          stateKey === undefined
            ? stateEvents
            : (stateEvents.find((event) => event.getStateKey() === stateKey) ??
              null),
        maySendStateEvent: (type: string, userId: string) =>
          type === MEETING_EVENT_TYPE && userId === SELF_ID && mayRecordMeeting,
      },
    }) as unknown as Room;

  const meetingEvent = (
    stateKey: string,
    content: Record<string, unknown>,
    sender = SELF_ID,
  ): MatrixEvent =>
    ({
      getContent: () => content,
      getSender: () => sender,
      getStateKey: () => stateKey,
    }) as unknown as MatrixEvent;

  const makeClient = (room: Room) => {
    const sendStateEvent = vi.fn(async () => ({
      event_id: "$state:localhost",
    }));
    const mx = {
      getRoom: () => room,
      getUserId: () => SELF_ID,
      getJoinedRooms: async () => ({ joined_rooms: [ROOM_ID] }),
      sendStateEvent,
    } as unknown as MatrixClient;
    return { mx, sendStateEvent };
  };

  it("creates a Meet room and records its link in the room state", async () => {
    const { mx, sendStateEvent } = makeClient(makeMeetingRoom());
    const createRoom = vi.fn(async () => MEET_ROOM);

    const meeting = await driverWithClient(mx).startChatMeeting(
      ROOM_ID,
      createRoom,
    );

    expect(createRoom).toHaveBeenCalledOnce();
    expect(sendStateEvent).toHaveBeenCalledWith(
      ROOM_ID,
      MEETING_EVENT_TYPE,
      {
        meetingUrl: MEET_ROOM.url,
        startedAt: expect.any(Number),
        organizerId: SELF_ID,
      },
      MEET_ROOM.slug,
    );
    expect(meeting).toMatchObject({
      id: MEET_ROOM.slug,
      url: MEET_ROOM.url,
      organizerId: SELF_ID,
    });
  });

  it("schedules a meeting with its title and duration next to an ongoing one", async () => {
    const ongoing = meetingEvent("xyz-abcd-efg", {
      meetingUrl: "https://meet.example.com/xyz-abcd-efg",
      startedAt: Date.now(),
    });
    const { mx, sendStateEvent } = makeClient(makeMeetingRoom([ongoing]));
    const createRoom = vi.fn(async () => MEET_ROOM);
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);

    const meeting = await driverWithClient(mx).startChatMeeting(
      ROOM_ID,
      createRoom,
      { title: " Point hebdo ", plannedDurationMinutes: 30, startsAt },
    );

    expect(createRoom).toHaveBeenCalledOnce();
    expect(sendStateEvent).toHaveBeenCalledWith(
      ROOM_ID,
      MEETING_EVENT_TYPE,
      {
        meetingUrl: MEET_ROOM.url,
        startedAt: startsAt.getTime(),
        organizerId: SELF_ID,
        title: "Point hebdo",
        plannedDurationMinutes: 30,
      },
      MEET_ROOM.slug,
    );
    expect(meeting).toMatchObject({
      title: "Point hebdo",
      startedAt: startsAt.toISOString(),
      plannedDurationMinutes: 30,
    });
  });

  it("closes the organizer's meeting and keeps its other fields", async () => {
    const content = {
      meetingUrl: MEET_ROOM.url,
      startedAt: Date.now() - 10 * 60 * 1000,
      organizerId: SELF_ID,
      plannedDurationMinutes: 30,
    };
    const { mx, sendStateEvent } = makeClient(
      makeMeetingRoom([meetingEvent(MEET_ROOM.slug, content)]),
    );

    await driverWithClient(mx).endChatMeeting(ROOM_ID, MEET_ROOM.slug);

    expect(sendStateEvent).toHaveBeenCalledWith(
      ROOM_ID,
      MEETING_EVENT_TYPE,
      { ...content, endedAt: expect.any(Number) },
      MEET_ROOM.slug,
    );
  });

  it("refuses to close a meeting organized by someone else", async () => {
    const event = meetingEvent(
      MEET_ROOM.slug,
      {
        meetingUrl: MEET_ROOM.url,
        startedAt: Date.now(),
        organizerId: OTHER_ID,
      },
      // The last writer is not the organizer.
      SELF_ID,
    );
    const { mx, sendStateEvent } = makeClient(makeMeetingRoom([event]));

    await expect(
      driverWithClient(mx).endChatMeeting(ROOM_ID, MEET_ROOM.slug),
    ).rejects.toBeInstanceOf(MeetingNotAllowedError);
    expect(sendStateEvent).not.toHaveBeenCalled();
  });

  it("extends the planned duration", async () => {
    const content = {
      meetingUrl: MEET_ROOM.url,
      startedAt: Date.now(),
      organizerId: SELF_ID,
      plannedDurationMinutes: 30,
    };
    const { mx, sendStateEvent } = makeClient(
      makeMeetingRoom([meetingEvent(MEET_ROOM.slug, content)]),
    );

    await driverWithClient(mx).extendChatMeeting(ROOM_ID, MEET_ROOM.slug, 15);

    expect(sendStateEvent).toHaveBeenCalledWith(
      ROOM_ID,
      MEETING_EVENT_TYPE,
      { ...content, plannedDurationMinutes: 45 },
      MEET_ROOM.slug,
    );
  });

  it("renames the meeting, and removes the name when it is emptied", async () => {
    const content = {
      meetingUrl: MEET_ROOM.url,
      startedAt: Date.now(),
      organizerId: SELF_ID,
      title: "Réunion",
    };
    const { mx, sendStateEvent } = makeClient(
      makeMeetingRoom([meetingEvent(MEET_ROOM.slug, content)]),
    );
    const driver = driverWithClient(mx);

    await driver.renameChatMeeting(ROOM_ID, MEET_ROOM.slug, "  Point hebdo ");
    await driver.renameChatMeeting(ROOM_ID, MEET_ROOM.slug, "   ");

    expect(sendStateEvent).toHaveBeenNthCalledWith(
      1,
      ROOM_ID,
      MEETING_EVENT_TYPE,
      { ...content, title: "Point hebdo" },
      MEET_ROOM.slug,
    );
    expect(sendStateEvent).toHaveBeenNthCalledWith(
      2,
      ROOM_ID,
      MEETING_EVENT_TYPE,
      { ...content, title: undefined },
      MEET_ROOM.slug,
    );
  });

  it("extends a meeting without planned duration from the time spent", async () => {
    const content = {
      meetingUrl: MEET_ROOM.url,
      startedAt: Date.now() - 20 * 60 * 1000,
      organizerId: SELF_ID,
    };
    const { mx, sendStateEvent } = makeClient(
      makeMeetingRoom([meetingEvent(MEET_ROOM.slug, content)]),
    );

    await driverWithClient(mx).extendChatMeeting(ROOM_ID, MEET_ROOM.slug, 15);

    expect(sendStateEvent).toHaveBeenCalledWith(
      ROOM_ID,
      MEETING_EVENT_TYPE,
      { ...content, plannedDurationMinutes: 35 },
      MEET_ROOM.slug,
    );
  });

  it("rejoins the ongoing meeting without creating a Meet room", async () => {
    const ongoing = {
      getContent: () => ({
        meetingUrl: "https://meet.example.com/xyz-abcd-efg",
        startedAt: Date.now(),
      }),
      getSender: () => OTHER_ID,
      getStateKey: () => "xyz-abcd-efg",
    } as unknown as MatrixEvent;
    const { mx, sendStateEvent } = makeClient(makeMeetingRoom([ongoing]));
    const createRoom = vi.fn(async () => MEET_ROOM);

    const meeting = await driverWithClient(mx).startChatMeeting(
      ROOM_ID,
      createRoom,
    );

    expect(createRoom).not.toHaveBeenCalled();
    expect(sendStateEvent).not.toHaveBeenCalled();
    expect(meeting.url).toBe("https://meet.example.com/xyz-abcd-efg");
  });

  it("records nothing when Meet cannot create the room", async () => {
    const { mx, sendStateEvent } = makeClient(makeMeetingRoom());
    const createRoom = vi.fn(async () => {
      throw new Error("Meet unavailable");
    });

    await expect(
      driverWithClient(mx).startChatMeeting(ROOM_ID, createRoom),
    ).rejects.toThrow("Meet unavailable");
    expect(sendStateEvent).not.toHaveBeenCalled();
  });
});

describe("MatrixDriver.startChatMeeting permissions", () => {
  it("refuses before creating a Meet room when the user may not record it", async () => {
    const sendStateEvent = vi.fn();
    const room = {
      roomId: ROOM_ID,
      currentState: {
        getStateEvents: () => [],
        maySendStateEvent: () => false,
      },
    } as unknown as Room;
    const mx = {
      getRoom: () => room,
      getUserId: () => SELF_ID,
      getJoinedRooms: async () => ({ joined_rooms: [ROOM_ID] }),
      sendStateEvent,
    } as unknown as MatrixClient;
    const createRoom = vi.fn();

    await expect(
      driverWithClient(mx).startChatMeeting(ROOM_ID, createRoom),
    ).rejects.toBeInstanceOf(MeetingNotAllowedError);
    expect(createRoom).not.toHaveBeenCalled();
    expect(sendStateEvent).not.toHaveBeenCalled();
  });

  it("lets every member of a new conversation start a meeting", async () => {
    const createRoomMock = vi.fn(async () => ({ room_id: ROOM_ID }));
    const room = {
      roomId: ROOM_ID,
      name: "Alice",
      getMembers: () => [],
      getMyMembership: () => KnownMembership.Join,
      getLastActiveTimestamp: () => 0,
      tags: {},
      currentState: { getStateEvents: () => undefined },
    } as unknown as Room;
    const mx = {
      getRoom: () => room,
      getUserId: () => SELF_ID,
      getJoinedRooms: async () => ({ joined_rooms: [] }),
      getRooms: () => [],
      createRoom: createRoomMock,
    } as unknown as MatrixClient;

    const driver = driverWithClient(mx);
    // No existing conversation with these members: a room is created.
    vi.spyOn(driver, "getChatForUsers").mockResolvedValue(null);

    await driver
      .createChatForUsers([OTHER_ID, "@bob:localhost"])
      .catch(() => undefined);

    expect(createRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({
        power_level_content_override: {
          events: { [MEETING_EVENT_TYPE]: 0 },
        },
      }),
    );
  });
});
