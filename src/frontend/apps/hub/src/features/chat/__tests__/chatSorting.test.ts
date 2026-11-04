import { describe, expect, it } from "vitest";

import type { Chat, ChatNotificationLevel } from "@/features/drivers/types";

import { compareChats } from "../chatSorting";

const chat = (
  id: string,
  lastActivityAt: string,
  notificationLevel?: ChatNotificationLevel,
): Chat => ({
  id,
  accountId: "account",
  ref: { accountId: "account", chatId: id },
  name: id,
  section: "all",
  kind: "group",
  participantIds: [],
  visual: { kind: "icon", icon: "groups" },
  lastActivityAt,
  notificationLevel,
});

const order = (chats: Chat[]) =>
  [...chats].sort(compareChats).map(({ id }) => id);

describe("compareChats", () => {
  it("sorts by latest activity", () => {
    expect(
      order([
        chat("old", "2026-01-01T00:00:00Z"),
        chat("new", "2026-01-02T00:00:00Z"),
      ]),
    ).toEqual(["new", "old"]);
  });

  it("puts muted chats last, whatever their activity", () => {
    expect(
      order([
        chat("muted", "2026-01-03T00:00:00Z", "mute"),
        chat("default", "2026-01-01T00:00:00Z", "default"),
        chat("all", "2026-01-02T00:00:00Z", "all_messages"),
        chat("mentions", "2026-01-01T12:00:00Z", "mentions_and_following"),
      ]),
    ).toEqual(["all", "mentions", "default", "muted"]);
  });

  it("sorts muted chats by activity among themselves", () => {
    expect(
      order([
        chat("old", "2026-01-01T00:00:00Z", "mute"),
        chat("new", "2026-01-02T00:00:00Z", "mute"),
      ]),
    ).toEqual(["new", "old"]);
  });

  it("never treats a chat in default or without a level as muted", () => {
    expect(
      order([
        chat("muted", "2026-01-03T00:00:00Z", "mute"),
        chat("unknown", "2026-01-01T00:00:00Z"),
      ]),
    ).toEqual(["unknown", "muted"]);
  });
});
