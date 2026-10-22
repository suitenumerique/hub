import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom, markRoomRead } from "./utils/flows";
import { uniqueText } from "./utils/ids";

const UNREAD_COUNT = 40;

/** E2E-06: what Bob did not read yet, and how reading clears it. */
test("shows unread messages and marks them read", async ({ people, hub }) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const carol = await people.create("Carol");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  await createUnencryptedRoom(carol, [bob]);
  await alice.api.sendText(roomId, uniqueText("Already read"));
  await markRoomRead(bob, roomId);

  const bobChat = await hub.open(bob);
  await bobChat.openConversation(carol.displayName);
  // More than the first page of 30 messages loaded when opening.
  const prefix = uniqueText("Message");
  await alice.api.sendMany(roomId, prefix, UNREAD_COUNT);

  await test.step("the conversation shows as unread", async () => {
    await bobChat.leftPanel.expectUnread(alice.displayName);
  });

  await test.step("opening it shows the unread banner", async () => {
    await bobChat.focus();
    await bobChat.openConversation(alice.displayName);
    await bobChat.timeline.expectMessage(`${prefix} [${UNREAD_COUNT}]`);
    await bobChat.timeline.expectUnreadBanner(
      `${UNREAD_COUNT} unread messages`,
    );
  });

  await test.step("the banner jumps to the first unread message", async () => {
    await bobChat.timeline.unreadBannerButton().click();
    await expect(bobChat.timeline.message(`${prefix} [1]`)).toBeInViewport({
      timeout: 15_000,
    });
    await bobChat.timeline.expectUnreadSeparatorBefore(`${prefix} [1]`);
  });

  await test.step("marking as read clears it, even after a reload", async () => {
    await bobChat.timeline.markAllRead();
    await bobChat.leftPanel.expectRead(alice.displayName);
    await bobChat.reload();
    await bobChat.leftPanel.expectRead(alice.displayName);
    await bobChat.openConversation(alice.displayName);
    await expect(bobChat.timeline.unreadBanner).toBeHidden();
  });

  await test.step("reading on another device clears the dot", async () => {
    await bobChat.openConversation(carol.displayName);
    const text = uniqueText("Read elsewhere");
    const eventId = await alice.api.sendText(roomId, text);
    await bobChat.leftPanel.expectUnread(alice.displayName);
    await bob.api.markRead(roomId, eventId);
    await bobChat.leftPanel.expectRead(alice.displayName);
  });
});

/**
 * Conversations never read yet, without any receipt or `m.fully_read`. Like
 * Element, the person's own join counts as read; without it in the loaded
 * messages, reading goes through the last message displayed.
 */
test.describe("Never-read conversations", () => {
  test("starts from the join and marks what is viewed read", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    await createUnencryptedRoom(carol, [bob]);
    const bobChat = await hub.open(bob);
    await bobChat.openConversation(alice.displayName);
    const text = uniqueText("First message");
    await alice.api.sendText(roomId, text);
    await bobChat.timeline.expectMessage(text);

    await bobChat.readOpenConversation(alice.displayName);
    await bobChat.openConversation(carol.displayName);
    await bobChat.leftPanel.expectRead(alice.displayName);
  });

  test("an invitation accepted in the Hub is read once viewed", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const bobChat = await hub.open(bob);
    const roomId = await alice.api.createRoom({
      invite: [bob.userId],
      isDirect: true,
    });
    const before = uniqueText("Before accepting");
    await alice.api.sendText(roomId, before);

    await bobChat.openConversation(alice.displayName);
    await bobChat.invitation.accept();
    await bobChat.timeline.expectMessage(before);
    // Bob's own join comes after it: it counts as read, as in Element.
    await bobChat.leftPanel.expectRead(alice.displayName);

    const after = uniqueText("After accepting");
    await alice.api.sendText(roomId, after);
    await bobChat.timeline.expectMessage(after);
    await bobChat.readOpenConversation(alice.displayName);
    await bobChat.reload();
    await bobChat.leftPanel.expectRead(alice.displayName);
  });

  test("reads through the last displayed message when the join is not loaded", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    // More than the first page of 30 messages: Bob's join is not loaded.
    const prefix = uniqueText("Message");
    await alice.api.sendMany(roomId, prefix, 45);

    const bobChat = await hub.open(bob);
    await bobChat.leftPanel.expectUnread(alice.displayName);
    await bobChat.openConversation(alice.displayName);
    await bobChat.timeline.expectMessage(`${prefix} [45]`);
    await bobChat.readOpenConversation(alice.displayName);

    await bobChat.reload();
    await bobChat.leftPanel.expectRead(alice.displayName);
  });
});
