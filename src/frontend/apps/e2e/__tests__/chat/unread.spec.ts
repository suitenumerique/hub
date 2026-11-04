import { SYNC_TIMEOUT } from "./utils/env";
import { expect, type Person, test } from "./utils/fixtures";
import {
  createEncryptedRoom,
  createUnencryptedRoom,
  markRoomRead,
  withSyncGap,
} from "./utils/flows";
import { uniqueText } from "./utils/ids";
import { READ_MARKER_REQUESTS } from "./utils/network";

/** As many unread messages as the issue's example: more than one screen. */
const UNREAD_COUNT = 26;
/** More than the first page of 30 messages loaded when opening. */
const MORE_THAN_LOADED = 45;
/** Hub-only room account data of the last visit, which Tchap ignores. */
const HUB_VISIT = "fr.gouv.lasuite.hub.visit";

/** The person's main read marker, `m.fully_read`. */
const fullyRead = async (person: Person, roomId: string) =>
  (await person.api.roomAccountData(roomId, "m.fully_read"))?.event_id ?? null;

/**
 * E2E-06: a conversation opens where its unread messages start, as Element's
 * jump to the read marker, and is then read as a whole.
 */
test.describe("Opening a conversation", () => {
  test("opens on the first unread message and reads the whole conversation", async ({
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
    const prefix = uniqueText("Message");
    const eventIds = await alice.api.sendMany(roomId, prefix, UNREAD_COUNT);
    const first = `${prefix} [1]`;
    const latest = `${prefix} [${UNREAD_COUNT}]`;

    await test.step("the conversation shows as unread", async () => {
      await bobChat.leftPanel.expectUnread(alice.displayName);
    });

    await test.step("it opens on the first unread message", async () => {
      await bobChat.openConversation(alice.displayName);
      await bobChat.timeline.expectOpenedOnFirstUnread(first);
      await expect(bobChat.timeline.message(latest)).not.toBeInViewport();
      await bobChat.timeline.expectJumpToLatest({ newMessages: false });
    });

    await test.step("all of it is read, not only what is shown", async () => {
      await bobChat.leftPanel.expectRead(alice.displayName);
      await expect.poll(() => fullyRead(bob, roomId)).toBe(eventIds.at(-1));
    });

    await test.step("left without scrolling, it reopens at the bottom", async () => {
      await bobChat.openConversation(carol.displayName);
      await bobChat.openConversation(alice.displayName);
      await bobChat.timeline.expectAtLatest(latest);
      await expect(bobChat.timeline.unreadSeparator).toHaveCount(0);
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

  test("opens on a first unread message older than the latest ones", async ({
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
    const prefix = uniqueText("Message");
    await alice.api.sendMany(roomId, prefix, MORE_THAN_LOADED);
    await bobChat.leftPanel.expectUnread(alice.displayName);

    await test.step("the messages around it load first", async () => {
      await bobChat.openConversation(alice.displayName);
      await bobChat.timeline.expectOpenedOnFirstUnread(`${prefix} [1]`);
      await bobChat.leftPanel.expectRead(alice.displayName);
    });

    await test.step("the jump loads the latest messages and focuses the composer", async () => {
      await bobChat.timeline.jumpToLatestButton.click();
      await bobChat.timeline.expectAtLatest(`${prefix} [${MORE_THAN_LOADED}]`);
      await expect(bobChat.composer.field).toBeFocused();
    });
  });

  test("waits for the page to be visible to read it", async ({
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
    const prefix = uniqueText("Message");
    const eventIds = await alice.api.sendMany(roomId, prefix, UNREAD_COUNT);
    await alice.api.sendText(roomId, uniqueText("Reply"), {
      threadRootId: eventIds[0],
    });
    await bobChat.leftPanel.expectUnread(alice.displayName);

    await test.step("opened in the background, it stays unread", async () => {
      await bobChat.setPageVisible(false);
      await bobChat.openConversation(alice.displayName);
      await bobChat.timeline.expectOpenedOnFirstUnread(`${prefix} [1]`);
      // Longer than reading takes once the page is visible.
      await bobChat.page.waitForTimeout(1_500);
      expect(await fullyRead(bob, roomId)).toBeNull();
      expect(await bob.api.roomAccountData(roomId, HUB_VISIT)).toBeNull();
      await bobChat.leftPanel.expectUnread(alice.displayName);
    });

    await test.step("once the page shows, it is read and its dot goes", async () => {
      await bobChat.setPageVisible(true);
      await bobChat.leftPanel.expectRead(alice.displayName);
      await expect.poll(() => fullyRead(bob, roomId)).toBe(eventIds.at(-1));
      await expect
        .poll(() => bob.api.roomAccountData(roomId, HUB_VISIT))
        .not.toBeNull();
    });
  });

  test("stops retrying a failed read once the conversation is left", async ({
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
    await alice.api.sendText(roomId, uniqueText("Unread"));
    await bobChat.leftPanel.expectUnread(alice.displayName);

    let attempts = 0;
    let failWrites: () => void = () => {};
    const writesFail = new Promise<void>((resolve) => {
      failWrites = resolve;
    });
    await bobChat.page.route(READ_MARKER_REQUESTS, async (route) => {
      attempts += 1;
      await writesFail;
      await route.abort();
    });

    await bobChat.openConversation(alice.displayName);
    await expect.poll(() => attempts).toBe(1);
    await bobChat.openConversation(carol.displayName);
    failWrites();
    // Longer than the first retry would wait.
    await bobChat.page.waitForTimeout(2_500);
    expect(attempts).toBe(1);
  });

  test("opens at the bottom without unread messages", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const prefix = uniqueText("Message");
    await alice.api.sendMany(roomId, prefix, UNREAD_COUNT);
    await markRoomRead(bob, roomId);

    const bobChat = await hub.open(bob);
    await bobChat.leftPanel.expectRead(alice.displayName);
    await bobChat.openConversation(alice.displayName);
    await bobChat.timeline.expectAtLatest(`${prefix} [${UNREAD_COUNT}]`);
    await expect(bobChat.timeline.unreadSeparator).toHaveCount(0);
  });
});

/** Like Element's jump to bottom, in any conversation away from its end. */
test("goes back to the latest messages, with a dot for new ones", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const carol = await people.create("Carol");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  const prefix = uniqueText("Message");
  await alice.api.sendMany(roomId, prefix, UNREAD_COUNT);
  await markRoomRead(bob, roomId);

  const bobChat = await hub.open(bob);
  await bobChat.openConversation(alice.displayName);
  await bobChat.timeline.expectAtLatest(`${prefix} [${UNREAD_COUNT}]`);

  const arrived = uniqueText("Arrived meanwhile");

  await test.step("scrolling up shows the jump", async () => {
    await bobChat.timeline.scroll();
    await bobChat.timeline.expectJumpToLatest({ newMessages: false });
  });

  await test.step("messages received meanwhile stay unread, with a dot", async () => {
    await alice.api.sendText(roomId, arrived);
    await bobChat.timeline.expectJumpToLatest({ newMessages: true });
    await bobChat.leftPanel.expectUnread(alice.displayName);
  });

  await test.step("the jump shows them, which reads them", async () => {
    await bobChat.timeline.jumpToLatestButton.click();
    await bobChat.timeline.expectAtLatest(arrived);
    await expect(bobChat.composer.field).toBeFocused();
    await bobChat.readOpenConversation(alice.displayName);
  });

  await test.step("the composer does not take the focus from New afterwards", async () => {
    await bobChat.leftPanel.openNewChat();
    await bobChat.newChat.add(carol);
    // Longer than the composer takes to grab the focus once it is enabled.
    await bobChat.page.waitForTimeout(1_000);
    await expect(bobChat.newChat.input).toBeFocused();
  });
});

test("keeps the focus in the conversation when the composer is blocked", async ({
  people,
  hub,
  devices,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const alicePhone = await devices.start(alice);
  const roomId = await createEncryptedRoom(alicePhone, [bob.api]);
  for (let index = 1; index <= UNREAD_COUNT; index++) {
    await alicePhone.sendText(roomId, uniqueText(`Message ${index}`));
  }

  const bobChat = await hub.open(bob);
  await bobChat.openConversation(alice.displayName);
  await bobChat.composer.expectBlocked();
  await bobChat.timeline.scroll();

  const { jumpToLatestButton, root } = bobChat.timeline;
  await jumpToLatestButton.focus();
  await bobChat.page.keyboard.press("Enter");
  await expect(jumpToLatestButton).toBeHidden({ timeout: SYNC_TIMEOUT });
  await expect(root.locator("[data-virtuoso-scroller]")).toBeFocused();
});

/**
 * Specific to the Hub, as Element keeps threads out of a room's dot: thread
 * replies show the dot until the conversation opens. The threads keep them
 * unread, and a newer reply brings the dot back.
 */
test.describe("Unread threads and the conversation dot", () => {
  test("opening reads the messages, not the threads, and removes the dot", async ({
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
    const root = uniqueText("Thread root");
    const rootId = await alice.api.sendText(roomId, root);
    const latestId = await alice.api.sendText(roomId, uniqueText("Message"));
    const reply = (text: string) =>
      alice.api.sendText(roomId, uniqueText(text), { threadRootId: rootId });
    await reply("First reply");
    await bobChat.leftPanel.expectUnread(alice.displayName);

    await test.step("opening removes the dot, the thread stays unread", async () => {
      await bobChat.openConversation(alice.displayName);
      await bobChat.leftPanel.expectRead(alice.displayName);
      await expect.poll(() => fullyRead(bob, roomId)).toBe(latestId);
      await bobChat.threads.expectUnreadThreadsBanner("1 unread thread");
      await expect(bobChat.timeline.threadButton(root)).toHaveText(
        "1 reply • 1 unread",
      );
    });

    await test.step("the visit is kept in Bob's account, even after a reload", async () => {
      await expect
        .poll(() => bob.api.roomAccountData(roomId, HUB_VISIT))
        .toMatchObject({ thread_ts: expect.any(Number) });
      await bobChat.reload();
      await bobChat.leftPanel.expectRead(alice.displayName);
      await bobChat.threads.expectUnreadThreadsBanner("1 unread thread");
    });

    await test.step("a reply while it is closed brings the dot back", async () => {
      await bobChat.openConversation(carol.displayName);
      await reply("Second reply");
      await bobChat.leftPanel.expectUnread(alice.displayName);
      await bobChat.openConversation(alice.displayName);
      await bobChat.leftPanel.expectRead(alice.displayName);
      await expect(bobChat.timeline.threadButton(root)).toHaveText(
        "2 replies • 2 unread",
      );
    });

    await test.step("a reply while it is open does not, even for a moment", async () => {
      const dotShown = await bobChat.leftPanel.watchDot(alice.displayName);
      await reply("Third reply");
      await expect(bobChat.timeline.threadButton(root)).toHaveText(
        "3 replies • 3 unread",
        { timeout: SYNC_TIMEOUT },
      );
      expect(await dotShown()).toBe(false);
      await bobChat.openConversation(carol.displayName);
      await bobChat.leftPanel.expectRead(alice.displayName);
    });
  });

  test("a reply the Hub did not receive still brings the dot back", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    await createUnencryptedRoom(carol, [bob]);
    const rootId = await alice.api.sendText(roomId, uniqueText("Thread root"));
    await alice.api.sendText(roomId, uniqueText("First reply"), {
      threadRootId: rootId,
    });
    await markRoomRead(bob, roomId);

    const bobChat = await hub.open(bob);
    await bobChat.openConversation(alice.displayName);
    await bobChat.leftPanel.expectRead(alice.displayName);
    await bobChat.openConversation(carol.displayName);

    // Events that notify nobody push the reply out of the next sync: only the
    // homeserver's notification count tells about it.
    await withSyncGap(bobChat, roomId, {
      wake: () => alice.api.react(roomId, rootId, "👍"),
      write: async () => {
        await alice.api.sendText(roomId, uniqueText("Missed reply"), {
          threadRootId: rootId,
        });
        for (let index = 1; index <= 25; index++) {
          await alice.api.sendState(roomId, "m.room.topic", {
            topic: `Topic ${index}`,
          });
        }
      },
    });
    await bobChat.leftPanel.expectUnread(alice.displayName);
  });

  test("a thread reply alone shows the dot until the conversation opens", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    await createUnencryptedRoom(carol, [bob]);
    const root = uniqueText("Thread root");
    const rootId = await alice.api.sendText(roomId, root);
    await markRoomRead(bob, roomId);

    const bobChat = await hub.open(bob);
    await bobChat.openConversation(carol.displayName);
    await bobChat.leftPanel.expectRead(alice.displayName);
    await alice.api.sendText(roomId, uniqueText("Reply"), {
      threadRootId: rootId,
    });
    await bobChat.leftPanel.expectUnread(alice.displayName);

    await bobChat.openConversation(alice.displayName);
    await bobChat.leftPanel.expectRead(alice.displayName);
    await bobChat.threads.expectUnreadThreadsBanner("1 unread thread");
    // No unread message: it opens at the bottom, without the separator.
    await bobChat.timeline.expectAtLatest(root);
    await expect(bobChat.timeline.unreadSeparator).toHaveCount(0);
  });

  test("a mention in a thread shows until the conversation opens", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    await createUnencryptedRoom(carol, [bob]);
    const root = uniqueText("Thread root");
    const rootId = await alice.api.sendText(roomId, root);
    await markRoomRead(bob, roomId);

    const bobChat = await hub.open(bob);
    await bobChat.openConversation(carol.displayName);
    await alice.api.sendText(roomId, `${bob.displayName}, can you look?`, {
      threadRootId: rootId,
      mentions: [bob.userId],
    });
    await bobChat.leftPanel.expectMention(alice.displayName);

    await bobChat.openConversation(alice.displayName);
    await bobChat.leftPanel.expectRead(alice.displayName);
    await bobChat.threads.expectUnreadThreadsBanner("1 unread thread");

    await test.step("a next reply brings the dot back, not the mention", async () => {
      await bobChat.openConversation(carol.displayName);
      await alice.api.sendText(roomId, uniqueText("Next reply"), {
        threadRootId: rootId,
      });
      await bobChat.leftPanel.expectUnread(alice.displayName);
      await bobChat.leftPanel.expectNoMention(alice.displayName);
    });
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

  test("opens at the bottom and reads it all when the join is not loaded", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    // Bob's join is not among the latest messages: no position to open on.
    const prefix = uniqueText("Message");
    await alice.api.sendMany(roomId, prefix, MORE_THAN_LOADED);

    const bobChat = await hub.open(bob);
    await bobChat.leftPanel.expectUnread(alice.displayName);
    await bobChat.openConversation(alice.displayName);
    await bobChat.timeline.expectAtLatest(`${prefix} [${MORE_THAN_LOADED}]`);
    await bobChat.leftPanel.expectRead(alice.displayName);

    await bobChat.reload();
    await bobChat.leftPanel.expectRead(alice.displayName);
  });
});
