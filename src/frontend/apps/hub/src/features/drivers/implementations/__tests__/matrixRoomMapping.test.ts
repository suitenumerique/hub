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

describe("matrixJoinedRoomToLocalChat", () => {
  it("maps m.favourite to the favourites section", () => {
    const room = {
      roomId: ROOM_ID,
      tags: { [MATRIX_FAVOURITE_TAG]: {} },
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
      getLastActiveTimestamp: () => 0,
      currentState: { getStateEvents: () => undefined },
    } as unknown as Room;

    expect(matrixJoinedRoomToLocalChat(room, SELF_ID).section).toBe(
      "favourites",
    );
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
