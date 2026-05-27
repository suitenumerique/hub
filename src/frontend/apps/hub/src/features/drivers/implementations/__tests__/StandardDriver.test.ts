import { describe, expect, it } from "vitest";

import { MOCK_CHATS } from "@/features/chat/mockChats";

import { StandardDriver } from "../StandardDriver";

const CHAT_ID = MOCK_CHATS[0].id;

describe("StandardDriver.toggleChatReaction", () => {
  it("toggles a reaction on a stored message and persists it", async () => {
    const driver = new StandardDriver();

    // "🔥" is outside the seeded palette, so it is always added fresh first.
    const added = await driver.toggleChatReaction({
      chatId: CHAT_ID,
      messageId: "m-1",
      emoji: "🔥",
    });
    const fire = added.reactions.find((reaction) => reaction.emoji === "🔥");
    expect(fire).toBeDefined();
    expect(fire?.reactedByMe).toBe(true);

    // The store is mutated, so a fresh fetch sees the reaction.
    const [latestPage] = (
      await driver.getChatMessages({ chatId: CHAT_ID, limit: 500 })
    ).messages.filter((message) => message.id === "m-1");
    expect(
      latestPage.reactions.some((reaction) => reaction.emoji === "🔥"),
    ).toBe(true);

    // Toggling again removes it.
    const removed = await driver.toggleChatReaction({
      chatId: CHAT_ID,
      messageId: "m-1",
      emoji: "🔥",
    });
    expect(
      removed.reactions.some((reaction) => reaction.emoji === "🔥"),
    ).toBe(false);
  });

  it("rejects when the message does not exist", async () => {
    const driver = new StandardDriver();

    await expect(
      driver.toggleChatReaction({
        chatId: CHAT_ID,
        messageId: "does-not-exist",
        emoji: "🔥",
      }),
    ).rejects.toThrow();
  });
});
