import { describe, expect, it } from "vitest";

import type { ChatEvent } from "../../Driver";
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

describe("MockDriver.createChatForUsers", () => {
  it("advertises conversation creation support", () => {
    expect(new MockDriver().supportsConversationCreation).toBe(true);
  });

  it("creates a direct conversation, named from the people directory", async () => {
    const driver = new MockDriver();

    const chat = await driver.createChatForUsers(["user-amandine-korsgaard"]);

    expect(chat.kind).toBe("direct");
    expect(chat.participantIds).toEqual(["user-amandine-korsgaard"]);
    expect(chat.name).toBe("Amandine Korsgaard");
    expect(chat.visual).toEqual({ kind: "initials" });
  });

  it("creates a group conversation regardless of participant order", async () => {
    const driver = new MockDriver();

    const chat = await driver.createChatForUsers([
      "user-jean-dustaff",
      "user-amandine-korsgaard",
    ]);

    expect(chat.kind).toBe("group");
    expect(chat.participantIds).toEqual([
      "user-amandine-korsgaard",
      "user-jean-dustaff",
    ]);
    expect(chat.visual).toEqual({ kind: "icon", icon: "groups" });
  });

  it("is idempotent: re-creating resolves the same conversation", async () => {
    const driver = new MockDriver();

    const first = await driver.createChatForUsers(["user-amandine-korsgaard"]);
    const second = await driver.createChatForUsers(["user-amandine-korsgaard"]);

    expect(second.id).toBe(first.id);
  });

  it("returns an existing seed conversation instead of creating a duplicate", async () => {
    const driver = new MockDriver();

    const created = await driver.createChatForUsers(["user-didier-salambo"]);

    expect(created.id).toBe(MOCK_CHATS[0].id);
  });

  it("makes a created conversation resolvable and fetchable", async () => {
    const driver = new MockDriver();

    const created = await driver.createChatForUsers(["user-amandine-korsgaard"]);

    await expect(
      driver.getChatForUsers(["user-amandine-korsgaard"]),
    ).resolves.toMatchObject({ id: created.id });
    await expect(driver.getChat(created.id)).resolves.toMatchObject({
      id: created.id,
    });
  });

  it("rejects an empty participant set", async () => {
    await expect(new MockDriver().createChatForUsers([])).rejects.toThrow();
  });
});

describe("MockDriver.toggleChatReaction", () => {
  it("returns account-local chat sections", async () => {
    const driver = new MockDriver("mock-support", { nameSuffix: "Support" });

    const sections = await driver.getChats();

    expect(sections.favourites[0].id).toBe(CHAT_ID);
    expect(sections.favourites[0].name).toContain("Support");
  });

  it("seeds unread from the mock flags and clears it on markChatRead", async () => {
    const driver = new MockDriver();

    const before = await driver.getUnread();
    const unreadId = Object.keys(before).find((id) => before[id].unread);
    expect(unreadId).toBeDefined();
    if (!unreadId) {
      return;
    }

    await driver.markChatRead(unreadId);

    const after = await driver.getUnread();
    expect(after[unreadId]).toEqual({ unread: false, highlight: false });
  });

  it("announces the cleared unread through the event stream", async () => {
    const driver = new MockDriver();
    const before = await driver.getUnread();
    const unreadId = Object.keys(before).find((id) => before[id].unread);
    expect(unreadId).toBeDefined();
    if (!unreadId) {
      return;
    }

    const events: ChatEvent[] = [];
    driver.subscribeToEvents((event) => events.push(event));

    await driver.markChatRead(unreadId);

    expect(events).toContainEqual({
      type: "unread:changed",
      chatId: unreadId,
      unread: { unread: false, highlight: false },
    });
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

describe("MockDriver composition", () => {
  it("sends a conversation message and persists it", async () => {
    const driver = new MockDriver();

    const sent = await driver.sendChatMessage({
      chatId: CHAT_ID,
      content: "Hello from the composer",
    });

    expect(sent.authorId).toBe("me");
    expect(sent.content).toBe("Hello from the composer");

    const refetched = await driver.getChatMessages({
      chatId: CHAT_ID,
      limit: 1_000,
    });
    expect(refetched.messages.some((message) => message.id === sent.id)).toBe(
      true,
    );
  });

  it("sends a thread reply and updates thread metadata", async () => {
    const driver = new MockDriver();
    const [thread] = await driver.getChatThreads(CHAT_ID);
    expect(thread).toBeDefined();
    if (!thread) {
      return;
    }

    const result = await driver.sendChatThreadReply({
      chatId: CHAT_ID,
      threadId: thread.id,
      content: "Reply from me",
    });

    expect(result.message.authorId).toBe("me");
    expect(result.thread.replyCount).toBe(thread.replyCount + 1);
    expect(result.thread.lastReplyPreview).toBe("Reply from me");
    expect(result.thread.unreadCount).toBe(0);

    const refetched = await driver.getChatThread({
      chatId: CHAT_ID,
      threadId: thread.id,
    });
    expect(
      refetched.messages.some((message) => message.id === result.message.id),
    ).toBe(true);
  });

  it("starts a new thread from a root message and persists it", async () => {
    const driver = new MockDriver();
    const messages = await driver.getChatMessages({
      chatId: CHAT_ID,
      limit: 1_000,
    });
    const root = messages.messages.find((message) => !message.thread);
    expect(root).toBeDefined();
    if (!root) {
      return;
    }

    const result = await driver.startChatThread({
      chatId: CHAT_ID,
      rootMessageId: root.id,
      content: "First reply",
    });

    expect(result.thread.rootMessageId).toBe(root.id);
    expect(result.thread.replyCount).toBe(1);
    expect(result.rootMessage.thread?.id).toBe(result.thread.id);
    expect(result.threadDetail.messages.map((message) => message.id)).toEqual([
      root.id,
      result.message.id,
    ]);

    const threads = await driver.getChatThreads(CHAT_ID);
    expect(threads.some((thread) => thread.id === result.thread.id)).toBe(true);
  });
});
