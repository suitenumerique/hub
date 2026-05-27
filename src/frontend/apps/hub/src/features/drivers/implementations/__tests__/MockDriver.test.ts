import { describe, expect, it } from "vitest";

import { MOCK_CHATS } from "../../mocks/mockChats";
import { MockDriver } from "../MockDriver";

const CHAT_ID = MOCK_CHATS[0].id;

describe("MockDriver.toggleChatReaction", () => {
  it("toggles a reaction on a stored message and persists it", async () => {
    const driver = new MockDriver();

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
    const driver = new MockDriver();

    await expect(
      driver.toggleChatReaction({
        chatId: CHAT_ID,
        messageId: "does-not-exist",
        emoji: "🔥",
      }),
    ).rejects.toThrow();
  });
});

describe("MockDriver threads", () => {
  it("returns threads scoped to the conversation, some unread", async () => {
    const driver = new MockDriver();

    const threads = await driver.getChatThreads(CHAT_ID);

    expect(threads.length).toBeGreaterThan(0);
    expect(threads.some((thread) => thread.unreadCount > 0)).toBe(true);
  });

  it("loads a thread's detail and marks it read", async () => {
    const driver = new MockDriver();

    const threads = await driver.getChatThreads(CHAT_ID);
    const unread = threads.find((thread) => thread.unreadCount > 0);
    expect(unread).toBeDefined();
    if (!unread) {
      return;
    }

    const detail = await driver.getChatThread({
      chatId: CHAT_ID,
      threadId: unread.id,
    });
    expect(detail.messages.length).toBeGreaterThan(1);
    expect(detail.firstUnreadIndex).not.toBeNull();

    await driver.markChatThreadRead({ chatId: CHAT_ID, threadId: unread.id });

    const refreshed = await driver.getChatThreads(CHAT_ID);
    expect(
      refreshed.find((thread) => thread.id === unread.id)?.unreadCount,
    ).toBe(0);
  });

  it("marks every thread of the conversation read", async () => {
    const driver = new MockDriver();

    await driver.markAllChatThreadsRead(CHAT_ID);

    const threads = await driver.getChatThreads(CHAT_ID);
    expect(threads.every((thread) => thread.unreadCount === 0)).toBe(true);
  });

  it("rejects when the thread does not exist", async () => {
    const driver = new MockDriver();

    await expect(
      driver.getChatThread({ chatId: CHAT_ID, threadId: "does-not-exist" }),
    ).rejects.toThrow();
  });

  it("toggles a reaction on a thread message and persists it", async () => {
    const driver = new MockDriver();

    const threads = await driver.getChatThreads(CHAT_ID);
    const threadId = threads[0]?.id;
    expect(threadId).toBeDefined();
    if (!threadId) {
      return;
    }
    const detail = await driver.getChatThread({ chatId: CHAT_ID, threadId });
    const reply = detail.messages.find(
      (message) => message.id !== detail.rootMessageId,
    );
    expect(reply).toBeDefined();
    if (!reply) {
      return;
    }

    const updated = await driver.toggleChatThreadReaction({
      chatId: CHAT_ID,
      threadId,
      messageId: reply.id,
      emoji: "🔥",
    });
    expect(updated.reactions.some((reaction) => reaction.emoji === "🔥")).toBe(
      true,
    );

    // The store is mutated, so a fresh fetch sees the reaction.
    const refetched = await driver.getChatThread({ chatId: CHAT_ID, threadId });
    const refetchedReply = refetched.messages.find(
      (message) => message.id === reply.id,
    );
    expect(
      refetchedReply?.reactions.some((reaction) => reaction.emoji === "🔥"),
    ).toBe(true);
  });

  it("rejects a thread reaction on an unknown message", async () => {
    const driver = new MockDriver();

    const threads = await driver.getChatThreads(CHAT_ID);
    const threadId = threads[0]?.id;
    expect(threadId).toBeDefined();
    if (!threadId) {
      return;
    }
    await expect(
      driver.toggleChatThreadReaction({
        chatId: CHAT_ID,
        threadId,
        messageId: "does-not-exist",
        emoji: "🔥",
      }),
    ).rejects.toThrow();
  });
});
