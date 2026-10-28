import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom, markRoomRead } from "./utils/flows";
import { uniqueText } from "./utils/ids";

/** Room account data Tchap and Element write to mark a room unread. */
const MARKED_UNREAD = "m.marked_unread";
/** Its type before MSC2867 was merged, still written by older clients. */
const MARKED_UNREAD_UNSTABLE = "com.famedly.marked_unread";

/** Marking a conversation unread to come back to it later, as in Tchap. */
test("marks a conversation unread and read from the conversation list", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const carol = await people.create("Carol");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  await createUnencryptedRoom(carol, [bob]);
  await alice.api.sendText(roomId, uniqueText("Already read"));
  await markRoomRead(bob, roomId);

  const bobChat = await hub.open(bob);
  await bobChat.openConversation(carol.displayName);
  await bobChat.leftPanel.expectRead(alice.displayName);

  await test.step("a right click marks it unread, stored as Tchap does", async () => {
    const menu = await bobChat.leftPanel.openContextMenu(alice.displayName);
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Add to favourites",
      "Mark as unread",
    ]);
    await menu.getByRole("menuitem", { name: "Mark as unread" }).click();
    await bobChat.leftPanel.expectUnread(alice.displayName);
    await expect
      .poll(() => bob.api.roomAccountData(roomId, MARKED_UNREAD))
      .toEqual({ unread: true });
  });

  await test.step("the more button marks it read, even after a reload", async () => {
    const menu = await bobChat.leftPanel.openMoreMenu(alice.displayName);
    await menu.getByRole("menuitem", { name: "Mark as read" }).click();
    await bobChat.leftPanel.expectRead(alice.displayName);
    await expect
      .poll(() => bob.api.roomAccountData(roomId, MARKED_UNREAD))
      .toEqual({ unread: false });
    await bobChat.reload();
    await bobChat.leftPanel.expectRead(alice.displayName);
  });

  await test.step("the more button is reachable with the keyboard", async () => {
    await bobChat.leftPanel.conversation(alice.displayName).focus();
    await bobChat.page.keyboard.press("Tab");
    await expect(bobChat.leftPanel.moreButton(alice.displayName)).toBeFocused();
    // Back from what follows, it is not skipped once the row lost the focus.
    await bobChat.page.keyboard.press("Tab");
    await bobChat.page.keyboard.press("Shift+Tab");
    await expect(bobChat.leftPanel.moreButton(alice.displayName)).toBeFocused();
  });

  await test.step("opening a conversation marked unread reads it", async () => {
    const menu = await bobChat.leftPanel.openContextMenu(alice.displayName);
    await menu.getByRole("menuitem", { name: "Mark as unread" }).click();
    await bobChat.leftPanel.expectUnread(alice.displayName);
    await bobChat.openConversation(alice.displayName);
    await bobChat.readOpenConversation(alice.displayName);
    await expect
      .poll(() => bob.api.roomAccountData(roomId, MARKED_UNREAD))
      .toEqual({ unread: false });
  });

  await test.step("the same menu adds it to favourites", async () => {
    const menu = await bobChat.leftPanel.openContextMenu(alice.displayName);
    await menu.getByRole("menuitem", { name: "Add to favourites" }).click();
    await bobChat.leftPanel.expectFavourite(alice.displayName);
  });
});

test("keeps the open conversation unread until its timeline is scrolled", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  const prefix = uniqueText("Message");
  await alice.api.sendMany(roomId, prefix, 20);
  await markRoomRead(bob, roomId);

  const bobChat = await hub.open(bob);
  await bobChat.openConversation(alice.displayName);
  await bobChat.timeline.expectMessage(`${prefix} [20]`);
  await bobChat.readOpenConversation(alice.displayName);

  await test.step("marked unread from the header, it stays unread", async () => {
    const menu = await bobChat.header.openMenu(alice.displayName);
    await menu.getByRole("menuitem", { name: "Mark as unread" }).click();
    await bobChat.leftPanel.expectUnread(alice.displayName);
    // Longer than reading the timeline takes once it is viewed.
    await bobChat.page.waitForTimeout(2_000);
    await bobChat.leftPanel.expectUnread(alice.displayName);
  });

  await test.step("scrolling the timeline reads it", async () => {
    await bobChat.timeline.scroll();
    await bobChat.leftPanel.expectRead(alice.displayName);
    await expect
      .poll(() => bob.api.roomAccountData(roomId, MARKED_UNREAD))
      .toEqual({ unread: false });
  });
});

test("marking the open conversation read reads its messages and threads", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const carol = await people.create("Carol");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  await createUnencryptedRoom(carol, [bob]);
  await alice.api.sendText(roomId, uniqueText("Already read"));
  await markRoomRead(bob, roomId);

  const bobChat = await hub.open(bob);
  await bobChat.openConversation(carol.displayName);
  // More than one screen: opening at the bottom leaves older ones unread.
  const prefix = uniqueText("Message");
  await alice.api.sendMany(roomId, prefix, 40);
  const root = uniqueText("Thread root");
  const rootId = await alice.api.sendText(roomId, root);
  await alice.api.sendText(roomId, uniqueText("Thread reply"), {
    threadRootId: rootId,
  });
  await bobChat.leftPanel.expectUnread(alice.displayName);

  await bobChat.focus();
  await bobChat.openConversation(alice.displayName);
  await bobChat.timeline.expectMessage(root);
  await expect(bobChat.timeline.unreadBanner).toBeVisible();
  await bobChat.threads.expectUnreadThreadsBanner("1 unread thread");

  const menu = await bobChat.header.openMenu(alice.displayName);
  await menu.getByRole("menuitem", { name: "Mark as read" }).click();

  await expect(bobChat.timeline.unreadBanner).toBeHidden();
  await expect(bobChat.threads.unreadBanner).toBeHidden();
  await expect(bobChat.timeline.threadButton(root)).toHaveText("1 reply");
  await bobChat.leftPanel.expectRead(alice.displayName);
  await bobChat.reload();
  await bobChat.leftPanel.expectRead(alice.displayName);
});

test("shares the unread mark with Tchap", async ({ people, hub }) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const carol = await people.create("Carol");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  const olderClientRoomId = await createUnencryptedRoom(carol, [bob]);
  await markRoomRead(bob, roomId);
  await markRoomRead(bob, olderClientRoomId);

  const bobChat = await hub.open(bob);
  await bobChat.leftPanel.expectRead(alice.displayName);
  await bobChat.leftPanel.expectRead(carol.displayName);

  await test.step("marked unread in Tchap, it shows unread live", async () => {
    await bob.api.setRoomAccountData(roomId, MARKED_UNREAD, { unread: true });
    await bobChat.leftPanel.expectUnread(alice.displayName);
  });

  await test.step("marked read in the Hub, Tchap sees it read", async () => {
    const menu = await bobChat.leftPanel.openContextMenu(alice.displayName);
    await menu.getByRole("menuitem", { name: "Mark as read" }).click();
    await bobChat.leftPanel.expectRead(alice.displayName);
    await expect
      .poll(() => bob.api.roomAccountData(roomId, MARKED_UNREAD))
      .toEqual({ unread: false });
  });

  await test.step("an older client's unstable mark shows unread", async () => {
    await bob.api.setRoomAccountData(
      olderClientRoomId,
      MARKED_UNREAD_UNSTABLE,
      { unread: true },
    );
    await bobChat.leftPanel.expectUnread(carol.displayName);
  });
});

test("offers no quick access menu on an invitation", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const bobChat = await hub.open(bob);
  await alice.api.createRoom({ invite: [bob.userId], isDirect: true });

  await bobChat.leftPanel.expectConversation(alice.displayName);
  await bobChat.leftPanel.conversation(alice.displayName).hover();
  await expect(bobChat.leftPanel.moreButton(alice.displayName)).toHaveCount(0);
});
