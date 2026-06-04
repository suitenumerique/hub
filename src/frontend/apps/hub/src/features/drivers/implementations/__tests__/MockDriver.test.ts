import { describe, expect, it } from "vitest";

import { MOCK_CHATS } from "../../mocks/mockChats";
import { MockDriver } from "../MockDriver";

const CHAT_ID = MOCK_CHATS[0].id;

describe("MockDriver new chat", () => {
  it("searches chat users by name and excludes already selected users", async () => {
    const driver = new MockDriver();

    const results = await driver.getChatUsers({
      q: "amandine",
      excludeIds: ["user-amandine-salambo"],
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((user) => user.id === "user-amandine-salambo")).toBe(
      false,
    );
    expect(results.every((user) => user.name.includes("Amandine"))).toBe(true);
  });

  it("resolves an existing direct conversation from one participant", async () => {
    const driver = new MockDriver();

    const chat = await driver.getChatForUsers(["user-didier-salambo"]);

    expect(chat?.id).toBe(MOCK_CHATS[0].id);
  });

  it("resolves an existing group regardless of participant order", async () => {
    const driver = new MockDriver();

    const chat = await driver.getChatForUsers([
      "user-daniel-ferioux",
      "user-amandine-salambo",
    ]);

    expect(chat?.name).toBe("Team chocolate");
  });

  it("keeps unknown participant sets unresolved", async () => {
    const driver = new MockDriver();

    await expect(
      driver.getChatForUsers([
        "user-amandine-salambo",
        "user-amandine-korsgaard",
      ]),
    ).resolves.toBeNull();
  });
});

describe("MockDriver.toggleChatReaction", () => {
  it("returns account-local chat sections", async () => {
    const driver = new MockDriver("mock-support", { nameSuffix: "Support" });

    const sections = await driver.getChats();

    expect(sections.favourites[0].id).toBe(CHAT_ID);
    expect(sections.favourites[0].name).toContain("Support");
  });

  it("keeps the same local chat id isolated per account", async () => {
    const main = new MockDriver("mock-main");
    const support = new MockDriver("mock-support", { nameSuffix: "Support" });

    await main.toggleChatReaction({
      chatId: CHAT_ID,
      messageId: "m-1",
      emoji: "🔥",
    });

    const mainMessage = (
      await main.getChatMessages({ chatId: CHAT_ID, limit: 1_000 })
    ).messages.find((message) => message.id === "m-1");
    const supportMessage = (
      await support.getChatMessages({ chatId: CHAT_ID, limit: 1_000 })
    ).messages.find((message) => message.id === "m-1");

    expect(
      mainMessage?.reactions.some((reaction) => reaction.emoji === "🔥"),
    ).toBe(true);
    expect(
      supportMessage?.reactions.some((reaction) => reaction.emoji === "🔥"),
    ).toBe(false);
  });

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
    expect(removed.reactions.some((reaction) => reaction.emoji === "🔥")).toBe(
      false,
    );
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
