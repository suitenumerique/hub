import { describe, expect, it } from "vitest";

import { buildBoardUrl, deriveBoardRoom } from "../meetingBoard";

describe("deriveBoardRoom", () => {
  it("gives every participant of a meeting the same room", async () => {
    const mine = await deriveBoardRoom("abc-defg-hij");
    const theirs = await deriveBoardRoom("abc-defg-hij");

    expect(mine).toEqual(theirs);
  });

  it("gives two meetings two rooms", async () => {
    const one = await deriveBoardRoom("abc-defg-hij");
    const other = await deriveBoardRoom("klm-nopq-rst");

    expect(one.roomId).not.toBe(other.roomId);
    expect(one.roomKey).not.toBe(other.roomKey);
  });

  it("derives a room and a key Excalidraw accepts", async () => {
    const { roomId, roomKey } = await deriveBoardRoom("abc-defg-hij");

    // 20 hexadecimal characters, then a 128-bit key as unpadded base64url.
    expect(roomId).toMatch(/^[0-9a-f]{20}$/);
    expect(roomKey).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});

describe("buildBoardUrl", () => {
  it("puts the room and its key in the fragment, never in the path", () => {
    const url = buildBoardUrl("https://board.example.com", {
      roomId: "0123456789abcdef0123",
      roomKey: "AAAAAAAAAAAAAAAAAAAAAA",
    });

    expect(url).toBe(
      "https://board.example.com/#room=0123456789abcdef0123,AAAAAAAAAAAAAAAAAAAAAA",
    );
  });

  it("does not double the slash of a base URL that ends with one", () => {
    const url = buildBoardUrl("https://board.example.com/", {
      roomId: "0123456789abcdef0123",
      roomKey: "AAAAAAAAAAAAAAAAAAAAAA",
    });

    expect(url).toBe(
      "https://board.example.com/#room=0123456789abcdef0123,AAAAAAAAAAAAAAAAAAAAAA",
    );
  });
});
