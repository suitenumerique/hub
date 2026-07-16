import { describe, expect, it } from "vitest";

import { getHubGroupHistoryRoomIds } from "../hubGroups";

describe("getHubGroupHistoryRoomIds", () => {
  it("orders every predecessor before the active room", () => {
    const rooms = [
      { room_id: "!active:localhost", role: "active" as const, sequence: 2 },
      {
        room_id: "!pending:localhost",
        role: "successor_pending" as const,
        sequence: 3,
      },
      {
        room_id: "!oldest:localhost",
        role: "predecessor" as const,
        sequence: 0,
      },
      {
        room_id: "!previous:localhost",
        role: "predecessor" as const,
        sequence: 1,
      },
    ];

    expect(getHubGroupHistoryRoomIds({ rooms })).toEqual([
      "!oldest:localhost",
      "!previous:localhost",
      "!active:localhost",
    ]);
    expect(rooms.map((room) => room.room_id)).toEqual([
      "!active:localhost",
      "!pending:localhost",
      "!oldest:localhost",
      "!previous:localhost",
    ]);
  });
});
