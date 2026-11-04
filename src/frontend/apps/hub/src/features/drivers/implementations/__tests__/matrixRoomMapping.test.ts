import {
  createClient,
  EventType,
  KnownMembership,
  MatrixEvent,
  Room,
} from "matrix-js-sdk/lib/matrix";
import { describe, expect, it } from "vitest";

import {
  matrixJoinedRoomToLocalChat,
  MATRIX_FAVOURITE_TAG,
} from "../matrixRoomMapping";

const ROOM_ID = "!room:localhost";
const SELF_ID = "@me:localhost";
const OTHER_ID = "@alice:localhost";

/** A joined room with one other person, shaped just enough for the mapping. */
const fakeRoom = (overrides: Record<string, unknown> = {}): Room =>
  ({
    roomId: ROOM_ID,
    client: {},
    tags: {},
    hasEncryptionStateEvent: () => false,
    getMxcAvatarUrl: () => null,
    getMembers: () => [
      {
        userId: OTHER_ID,
        name: "Alice",
        membership: KnownMembership.Join,
        getMxcAvatarUrl: () => null,
      },
    ],
    getInvitedAndJoinedMemberCount: () => 2,
    getJoinedMemberCount: () => 2,
    getLiveTimeline: () => ({ getEvents: () => [] }),
    getThreads: () => [],
    currentState: { getStateEvents: () => undefined },
    ...overrides,
  }) as unknown as Room;

const timelineEvent = (
  ts: number,
  type: string = EventType.RoomMessage,
  relation?: Record<string, unknown>,
) =>
  new MatrixEvent({
    room_id: ROOM_ID,
    event_id: `$${ts}`,
    type,
    origin_server_ts: ts,
    content: relation ? { "m.relates_to": relation } : {},
  });

const roomWith = (
  events: MatrixEvent[],
  threadReplies: (MatrixEvent | null)[] = [],
  rootOfThread?: MatrixEvent,
) =>
  fakeRoom({
    getLiveTimeline: () => ({ getEvents: () => events }),
    getThreads: () =>
      threadReplies.map((reply) => ({
        replyToEvent: reply,
        rootEvent: rootOfThread,
      })),
  });

const lastActivity = (room: Room) =>
  matrixJoinedRoomToLocalChat(room, SELF_ID).lastActivityAt;

const iso = (ts: number) => new Date(ts).toISOString();

describe("matrixJoinedRoomToLocalChat", () => {
  it("maps m.favourite to the favourites section", () => {
    const room = fakeRoom({ tags: { [MATRIX_FAVOURITE_TAG]: {} } });

    expect(matrixJoinedRoomToLocalChat(room, SELF_ID).section).toBe(
      "favourites",
    );
  });

  describe("last activity", () => {
    it("ignores reactions, also encrypted ones, and redactions", () => {
      const annotation = {
        rel_type: "m.annotation",
        event_id: "$1000",
        key: "👍",
      };
      expect(
        lastActivity(
          roomWith([
            timelineEvent(1000),
            timelineEvent(2000, EventType.Reaction, annotation),
            timelineEvent(3000, EventType.RoomMessageEncrypted, annotation),
            timelineEvent(4000, EventType.RoomRedaction),
          ]),
        ),
      ).toBe(iso(1000));
    });

    it("ignores a removed reaction, which has lost its relation", () => {
      const removed = timelineEvent(2000, EventType.RoomMessageEncrypted);
      removed.makeRedacted(
        timelineEvent(3000, EventType.RoomRedaction),
        fakeRoom(),
      );
      expect(lastActivity(roomWith([timelineEvent(1000), removed]))).toBe(
        iso(1000),
      );
    });

    it("takes the most recent, thread replies included", () => {
      expect(
        lastActivity(
          roomWith(
            [timelineEvent(1000)],
            [timelineEvent(500), timelineEvent(3000)],
          ),
        ),
      ).toBe(iso(3000));
      expect(
        lastActivity(roomWith([timelineEvent(4000)], [timelineEvent(3000)])),
      ).toBe(iso(4000));
    });

    it("falls back on the root of a thread without a known reply", () => {
      expect(
        lastActivity(
          roomWith([timelineEvent(1000)], [null], timelineEvent(2000)),
        ),
      ).toBe(iso(2000));
    });

    it("keeps the oldest event when only ignored ones are known", () => {
      expect(
        lastActivity(
          roomWith([
            timelineEvent(1000, EventType.RoomRedaction),
            timelineEvent(2000, EventType.RoomRedaction),
          ]),
        ),
      ).toBe(iso(1000));
    });

    it("has none without any event", () => {
      expect(lastActivity(roomWith([]))).toBeUndefined();
    });
  });

  describe("notification levels", () => {
    const rulesWith = (global: Record<string, unknown>) => ({
      pushRules: { global },
    });

    it("are absent while the push rules are not loaded", () => {
      expect(
        matrixJoinedRoomToLocalChat(fakeRoom(), SELF_ID),
      ).not.toHaveProperty("notificationLevel");
    });

    it("read the rule of a two-person chat for what it inherits", () => {
      const client = rulesWith({
        underride: [
          {
            rule_id: ".m.rule.room_one_to_one",
            enabled: true,
            actions: ["notify"],
          },
          {
            rule_id: ".m.rule.message",
            enabled: true,
            actions: ["dont_notify"],
          },
        ],
      });
      expect(
        matrixJoinedRoomToLocalChat(fakeRoom({ client }), SELF_ID),
      ).toMatchObject({
        notificationLevel: "default",
        effectiveNotificationLevel: "all_messages",
      });
      expect(
        matrixJoinedRoomToLocalChat(
          fakeRoom({ client, getJoinedMemberCount: () => 3 }),
          SELF_ID,
        ),
      ).toMatchObject({
        notificationLevel: "default",
        effectiveNotificationLevel: "mentions_and_following",
      });
    });
  });

  it.each([
    { roomName: null, joined: 2, invited: 0, kind: "direct", name: "Alice" },
    // A group left with one other person keeps its name.
    {
      roomName: "QA group",
      joined: 2,
      invited: 0,
      kind: "group",
      name: "QA group",
    },
    {
      roomName: "QA group",
      joined: 3,
      invited: 0,
      kind: "group",
      name: "QA group",
    },
    {
      roomName: "QA group",
      joined: 2,
      invited: 1,
      kind: "group",
      name: "QA group",
    },
  ])(
    "maps a room named $roomName with $joined joined and $invited invited members when only Alice is known",
    ({ roomName, joined, invited, kind, name }) => {
      const client = createClient({
        baseUrl: "https://matrix.example.org",
        userId: SELF_ID,
      });
      const room = new Room(ROOM_ID, client, SELF_ID, {
        lazyLoadMembers: true,
      });
      room.currentState.setStateEvents([
        ...(roomName
          ? [
              new MatrixEvent({
                room_id: ROOM_ID,
                type: EventType.RoomName,
                state_key: "",
                content: { name: roomName },
              }),
            ]
          : []),
        ...[
          { id: SELF_ID, name: "Me" },
          { id: OTHER_ID, name: "Alice" },
        ].map(
          (member) =>
            new MatrixEvent({
              room_id: ROOM_ID,
              type: EventType.RoomMember,
              state_key: member.id,
              content: {
                membership: KnownMembership.Join,
                displayname: member.name,
              },
            }),
        ),
      ]);
      room.currentState.setJoinedMemberCount(joined);
      room.currentState.setInvitedMemberCount(invited);

      expect(matrixJoinedRoomToLocalChat(room, SELF_ID)).toMatchObject({
        kind,
        name,
      });
    },
  );
});
