import {
  EventType,
  MatrixEvent,
  type Room,
  type Thread,
} from "matrix-js-sdk/lib/matrix";
import { describe, expect, it } from "vitest";

import {
  receiptThreadIds,
  timelineEventToChatEvent,
} from "../matrixEventMapping";

const ROOM_ID = "!room:localhost";
const SELF_ID = "@me:localhost";
const OTHER_ID = "@alice:localhost";

type SeedReaction = {
  key: string;
  sender: string;
  id?: string;
  /** Send time; reactions are listed by first appearance. */
  ts?: number;
};

const makeReactionEvent = (
  targetId: string,
  reaction: SeedReaction,
): MatrixEvent =>
  ({
    getType: () => "m.reaction",
    isEncrypted: () => false,
    isRedacted: () => false,
    getId: () => reaction.id ?? `$reaction-${reaction.sender}`,
    getSender: () => reaction.sender,
    getTs: () => reaction.ts ?? 1_700_000_000_000,
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
    isEncrypted: () => false,
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
    replacingEvent: () => null,
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
    hasEncryptionStateEvent: () => false,
    getMember: (id: string) => ({
      name: id === SELF_ID ? "Me" : id,
      getMxcAvatarUrl: () => null,
    }),
    currentState: {
      getStateEvents: () => null,
      maySendRedactionForEvent: () => false,
    },
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

  it.each([EventType.RoomMessage, EventType.RoomMessageEncrypted])(
    "suppresses this session's %s echoes before the coarse fallback",
    (type) => {
      const txnTagged = makeMessageEvent({
        sender: SELF_ID,
        body: "mine",
        type,
        transactionId: "m1729-1",
      });
      const inFlight = makeMessageEvent({
        sender: SELF_ID,
        body: "mine",
        type,
        status: "sending",
      });

      expect(timelineEventToChatEvent(txnTagged, makeRoom(), SELF_ID)).toEqual(
        [],
      );
      expect(timelineEventToChatEvent(inFlight, makeRoom(), SELF_ID)).toEqual(
        [],
      );
    },
  );

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

  it("adds a reply to its own thread, never to the main timeline", () => {
    const threadReply = makeMessageEvent({
      sender: OTHER_ID,
      body: "reply",
      id: "$reply:localhost",
      threadRootId: "$root:localhost",
    });
    const member = makeMessageEvent({
      sender: OTHER_ID,
      type: "m.room.member",
    });

    expect(timelineEventToChatEvent(threadReply, makeRoom(), SELF_ID)).toEqual([
      expect.objectContaining({
        type: "thread:reply",
        chatId: ROOM_ID,
        threadId: "$root:localhost",
        message: expect.objectContaining({
          id: "$reply:localhost",
          content: "reply",
        }),
      }),
      // Other open threads keep their messages: only the lists refresh.
      { type: "threads:changed", chatId: ROOM_ID, invalidateDetails: false },
    ]);
    expect(timelineEventToChatEvent(member, makeRoom(), SELF_ID)).toEqual([
      { type: "chat:changed", chatId: ROOM_ID },
    ]);
  });
});

describe("reaction aggregation", () => {
  it("lists reactions by first appearance, whatever the arrival order", () => {
    const targetId = "$target:localhost";
    const room = makeRoom({
      [targetId]: [
        { key: "✅", sender: OTHER_ID, ts: 2_000 },
        { key: "👍", sender: SELF_ID, ts: 1_000 },
        { key: "✅", sender: SELF_ID, ts: 3_000 },
      ],
    });
    const reaction = makeMessageEvent({
      sender: OTHER_ID,
      type: "m.reaction",
      relation: { rel_type: "m.annotation", event_id: targetId, key: "✅" },
    });

    expect(timelineEventToChatEvent(reaction, room, SELF_ID)).toEqual([
      {
        type: "reaction:updated",
        chatId: ROOM_ID,
        messageId: targetId,
        reactions: [
          { emoji: "👍", count: 1, reactedByMe: true },
          { emoji: "✅", count: 2, reactedByMe: true },
        ],
      },
    ]);
  });
});

describe("receiptThreadIds", () => {
  const receipt = (receipts: Record<string, Record<string, unknown>>) =>
    new MatrixEvent({
      type: EventType.Receipt,
      room_id: ROOM_ID,
      content: Object.fromEntries(
        Object.entries(receipts).map(([eventId, byUser]) => [
          eventId,
          { "m.read": byUser },
        ]),
      ),
    });

  it("names the threads this user's threaded receipts read", () => {
    expect(
      receiptThreadIds(
        receipt({
          $a: { [SELF_ID]: { ts: 1, thread_id: "$thread:localhost" } },
          $b: { [OTHER_ID]: { ts: 1, thread_id: "$other:localhost" } },
        }),
        SELF_ID,
      ),
    ).toEqual(["$thread:localhost"]);
  });

  it("changes no thread for a receipt of the main timeline", () => {
    expect(
      receiptThreadIds(
        receipt({ $a: { [SELF_ID]: { ts: 1, thread_id: "main" } } }),
        SELF_ID,
      ),
    ).toEqual([]);
  });

  it("may change every thread for an unthreaded receipt", () => {
    expect(
      receiptThreadIds(receipt({ $a: { [SELF_ID]: { ts: 1 } } }), SELF_ID),
    ).toBe("all");
  });
});
