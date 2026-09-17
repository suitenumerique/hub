import { describe, expect, it, vi } from "vitest";

import { LazyMatrixDriver } from "../LazyMatrixDriver";

const startChatMeetingMock = vi.hoisted(() => vi.fn());
const getChatMeetingsMock = vi.hoisted(() => vi.fn());
const endChatMeetingMock = vi.hoisted(() => vi.fn());
const extendChatMeetingMock = vi.hoisted(() => vi.fn());
const renameChatMeetingMock = vi.hoisted(() => vi.fn());
const addChatMeetingDocumentMock = vi.hoisted(() => vi.fn());
const getOpenIdTokenMock = vi.hoisted(() => vi.fn());

// The real driver pulls in matrix-js-sdk: only the meeting calls matter here.
vi.mock("../MatrixDriver", () => ({
  MatrixDriver: class {
    initialize() {}
    destroy() {}
    subscribeToEvents() {
      return () => {};
    }
    subscribeToChatTyping() {
      return () => {};
    }
    startChatMeeting = startChatMeetingMock;
    getChatMeetings = getChatMeetingsMock;
    endChatMeeting = endChatMeetingMock;
    extendChatMeeting = extendChatMeetingMock;
    renameChatMeeting = renameChatMeetingMock;
    addChatMeetingDocument = addChatMeetingDocumentMock;
    getOpenIdToken = getOpenIdTokenMock;
  },
}));

const ROOM_ID = "!room:localhost";

describe("LazyMatrixDriver meetings", () => {
  it("advertises meeting support before the SDK loads", () => {
    expect(new LazyMatrixDriver("matrix").supportsMeetings).toBe(true);
  });

  it("forwards meeting calls to the real Matrix driver", async () => {
    const meeting = {
      id: "abc-defg-hij",
      url: "https://meet.example.com/abc-defg-hij",
      organizerId: "@me:localhost",
      startedAt: "2026-09-16T10:00:00.000Z",
      documents: [],
    };
    startChatMeetingMock.mockResolvedValue(meeting);
    getChatMeetingsMock.mockResolvedValue([meeting]);
    endChatMeetingMock.mockResolvedValue(undefined);
    extendChatMeetingMock.mockResolvedValue(undefined);
    const createRoom = vi.fn();
    const options = { title: "Point hebdo", plannedDurationMinutes: 30 };
    const driver = new LazyMatrixDriver("matrix");

    await expect(
      driver.startChatMeeting(ROOM_ID, createRoom, options),
    ).resolves.toBe(meeting);
    await expect(driver.getChatMeetings(ROOM_ID)).resolves.toEqual([meeting]);
    await driver.endChatMeeting(ROOM_ID, meeting.id);
    await driver.extendChatMeeting(ROOM_ID, meeting.id, 15);
    await driver.renameChatMeeting(ROOM_ID, meeting.id, "Point hebdo");
    const transcript = { id: "doc", title: "Doc", url: "https://x/doc" };
    await driver.addChatMeetingDocument(ROOM_ID, meeting.id, transcript);

    expect(startChatMeetingMock).toHaveBeenCalledWith(
      ROOM_ID,
      createRoom,
      options,
    );
    expect(getChatMeetingsMock).toHaveBeenCalledWith(ROOM_ID);
    expect(endChatMeetingMock).toHaveBeenCalledWith(ROOM_ID, meeting.id);
    expect(extendChatMeetingMock).toHaveBeenCalledWith(ROOM_ID, meeting.id, 15);
    expect(addChatMeetingDocumentMock).toHaveBeenCalledWith(
      ROOM_ID,
      meeting.id,
      transcript,
    );
    expect(renameChatMeetingMock).toHaveBeenCalledWith(
      ROOM_ID,
      meeting.id,
      "Point hebdo",
    );
  });

  it("forwards the OpenID token request", async () => {
    getOpenIdTokenMock.mockResolvedValue("openid-token");

    await expect(new LazyMatrixDriver("matrix").getOpenIdToken()).resolves.toBe(
      "openid-token",
    );
  });
});
