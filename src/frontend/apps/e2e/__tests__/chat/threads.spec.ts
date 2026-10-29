import { SYNC_TIMEOUT } from "./utils/env";
import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom, markRoomRead } from "./utils/flows";
import { uniqueText } from "./utils/ids";
import {
  delayRequests,
  SEND_REQUESTS,
  THREAD_LIST_REQUESTS,
} from "./utils/network";
import { watchText } from "./utils/watch";

/** E2E-08: starting a thread, reading it and answering it live. */
test("starts a thread that the other person reads and answers", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  const root = uniqueText("Thread root");
  await alice.api.sendText(roomId, root);
  const aliceChat = await hub.open(alice);
  const bobChat = await hub.open(bob);
  await aliceChat.openConversation(bob.displayName);
  await bobChat.openConversation(alice.displayName);
  await bobChat.timeline.expectMessage(root);

  await test.step("Alice replies and starts the thread", async () => {
    await aliceChat.timeline.reply(root);
    await aliceChat.threads.expectThread(root);
    const first = uniqueText("First reply");
    await aliceChat.threads.composer.send(first);
    await aliceChat.threads.timeline.expectMessageOnce(first);
    await expect(aliceChat.timeline.threadButton(root)).toHaveText("1 reply");
  });

  await test.step("Bob sees an unread thread", async () => {
    await expect(bobChat.timeline.threadButton(root)).toHaveText(
      "1 reply • 1 unread",
      { timeout: 20_000 },
    );
    await bobChat.threads.expectUnreadThreadsBanner("1 unread thread");
  });

  await test.step("opening the thread reads it", async () => {
    await bobChat.timeline.threadButton(root).click();
    await bobChat.threads.expectThread(root);
    await expect(bobChat.timeline.threadButton(root)).toHaveText("1 reply");
    await expect(bobChat.threads.unreadBanner).toBeHidden();
  });

  await test.step("Bob's answer shows in Alice's open thread", async () => {
    const answer = uniqueText("Bob's answer");
    await bobChat.threads.composer.send(answer);
    await aliceChat.threads.timeline.expectMessageOnce(answer);
    await expect(aliceChat.timeline.threadButton(root)).toHaveText("2 replies");
  });
});

test("keeps a thread reply shown while it is being sent", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  const root = uniqueText("Thread root");
  const rootId = await alice.api.sendText(roomId, root);
  await alice.api.sendText(roomId, uniqueText("First reply"), {
    threadRootId: rootId,
  });
  const aliceChat = await hub.open(alice);
  await aliceChat.openConversation(bob.displayName);
  await aliceChat.timeline.threadButton(root).click();
  await aliceChat.threads.expectThread(root);

  // Encrypting for a large room on a busy homeserver takes seconds.
  const slowSend = await delayRequests(aliceChat.page, SEND_REQUESTS, 8000);
  const reply = uniqueText("Slow reply");
  const shown = await watchText(aliceChat.threads.messages, reply);
  await aliceChat.threads.composer.send(reply);
  await slowSend.held;
  await aliceChat.threads.timeline.expectMessageOnce(reply);

  // Bob answers meanwhile: the thread shows it without losing Alice's reply.
  const answer = uniqueText("Bob's answer");
  await bob.api.sendText(roomId, answer, { threadRootId: rootId });
  await aliceChat.threads.timeline.expectMessage(answer);

  await slowSend.stop();
  await aliceChat.threads.timeline.expectMessageOnce(reply);
  // Not even for a few milliseconds, which a slower send would stretch.
  expect(await shown.disappearances()).toBe(0);
});

test("starts a thread whose first reply shows while it is sent", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  const root = uniqueText("Thread root");
  await alice.api.sendText(roomId, root);
  const aliceChat = await hub.open(alice);
  await aliceChat.openConversation(bob.displayName);

  // Reply opens the root's thread at once, as in Element.
  await aliceChat.timeline.reply(root);
  await aliceChat.threads.expectThread(root);

  const slowSend = await delayRequests(aliceChat.page, SEND_REQUESTS, 8000);
  const first = uniqueText("First reply");
  const shown = await watchText(aliceChat.threads.messages, first);
  await aliceChat.threads.composer.send(first);
  await slowSend.held;
  // Shown while it is sent, under a root without "1 reply" in the thread.
  await expect(aliceChat.threads.timeline.message(first)).toBeVisible({
    timeout: 2000,
  });
  await expect(
    aliceChat.threads.messages.locator(".hub__chat-thread-button"),
  ).toHaveCount(0);
  await expect(aliceChat.timeline.threadButton(root)).toHaveText("1 reply");

  await slowSend.stop();
  await aliceChat.threads.timeline.expectMessageOnce(first);
  await expect(aliceChat.timeline.threadButton(root)).toHaveText("1 reply");
  expect(await shown.disappearances()).toBe(0);
});

/**
 * Reading a thread must reach the homeserver, which keeps counting its
 * replies otherwise: they come back unread with its next sync or a reload.
 * Bob never sent a threaded receipt in the room yet.
 */
test("marks unread threads read, from the thread or from the banner", async ({
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
  const opened = uniqueText("Opened thread");
  const fromBanner = uniqueText("Banner thread");
  for (const root of [opened, fromBanner]) {
    const rootId = await alice.api.sendText(roomId, root);
    await alice.api.sendText(roomId, uniqueText("Reply"), {
      threadRootId: rootId,
    });
  }

  await bobChat.focus();
  await bobChat.openConversation(alice.displayName);
  await bobChat.threads.expectUnreadThreadsBanner("2 unread threads");

  await test.step("opening a thread reads it", async () => {
    await bobChat.timeline.threadButton(opened).click();
    await bobChat.threads.expectThread(opened);
    await bobChat.threads.expectUnreadThreadsBanner("1 unread thread");
  });

  await test.step("the banner reads the others, not the timeline", async () => {
    await bobChat.threads.markAllRead();
    await expect(bobChat.timeline.unreadBanner).toBeVisible();
  });

  await test.step("both stay read after a reload, with one reply each", async () => {
    await bobChat.reload();
    for (const root of [opened, fromBanner]) {
      await expect(bobChat.timeline.threadButton(root)).toHaveText("1 reply", {
        timeout: SYNC_TIMEOUT,
      });
    }
    await expect(bobChat.threads.unreadBanner).toBeHidden();
    await expect(bobChat.timeline.unreadBanner).toBeVisible();
  });
});

/** The root's server summary still counts a reply deleted since it loaded. */
test("keeps a deleted reply out of the thread reply count", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  const root = uniqueText("Thread root");
  const rootId = await alice.api.sendText(roomId, root);
  await alice.api.sendText(roomId, uniqueText("Kept reply"), {
    threadRootId: rootId,
  });
  const deletedId = await alice.api.sendText(
    roomId,
    uniqueText("Deleted reply"),
    { threadRootId: rootId },
  );

  const bobChat = await hub.open(bob);
  await bobChat.openConversation(alice.displayName);
  const button = bobChat.timeline.threadButton(root);
  await expect(button).toContainText("2 replies", { timeout: SYNC_TIMEOUT });

  await test.step("Alice deletes a reply", async () => {
    await alice.api.redact(roomId, deletedId);
    await expect(button).toContainText("1 reply", { timeout: SYNC_TIMEOUT });
  });

  await test.step("it stays out once the thread is opened", async () => {
    await button.click();
    await bobChat.threads.expectThread(root);
    await expect(button).toHaveText("1 reply");
  });

  await test.step("and after a reload", async () => {
    await bobChat.reload();
    await expect(button).toHaveText("1 reply", { timeout: SYNC_TIMEOUT });
  });
});

/** Like Element's thread panel: the first page, then older ones on scroll. */
test("loads the thread list page by page while scrolling", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  // More threads than the first page of the list holds.
  const reply = uniqueText("Reply");
  for (let index = 1; index <= 40; index++) {
    const rootId = await alice.api.sendText(roomId, uniqueText("Root"));
    await alice.api.sendText(roomId, `${reply} [${index}]`, {
      threadRootId: rootId,
    });
  }

  const bobChat = await hub.open(bob);
  const olderPages: string[] = [];
  bobChat.page.on("request", (request) => {
    const url = request.url();
    if (THREAD_LIST_REQUESTS.test(url) && new URL(url).searchParams.has("from"))
      olderPages.push(url);
  });
  await bobChat.openConversation(alice.displayName);
  await bobChat.threads.openList();

  await test.step("the list opens on the latest threads", async () => {
    await expect(bobChat.threads.listedThread(`${reply} [40]`)).toBeVisible({
      timeout: SYNC_TIMEOUT,
    });
    expect(olderPages).toEqual([]);
  });

  await test.step("older threads load while scrolling down", async () => {
    await bobChat.threads.expectThreadListedBelow(`${reply} [1]`);
    expect(olderPages.length).toBeGreaterThan(0);
  });
});

/** Like Element's thread view: the latest replies, then older ones on scroll. */
test("opens a long thread on its latest replies, then loads older ones", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  const root = uniqueText("Long thread");
  const rootId = await alice.api.sendText(roomId, root);
  // More replies than a thread opens with.
  const reply = uniqueText("Reply");
  for (let index = 1; index <= 60; index++) {
    await alice.api.sendText(roomId, `${reply} [${index}]`, {
      threadRootId: rootId,
    });
  }

  const bobChat = await hub.open(bob);
  // A page of replies without a next token reached the root.
  const repliesPath = `/relations/${encodeURIComponent(rootId)}?`;
  const pages: Promise<void>[] = [];
  let reachedRoot = false;
  bobChat.page.on("response", (response) => {
    if (!response.url().includes(repliesPath)) return;
    pages.push(
      response.json().then(
        (body: { next_batch?: string }) => {
          if (!body.next_batch) reachedRoot = true;
        },
        () => {},
      ),
    );
  });
  await bobChat.openConversation(alice.displayName);
  await bobChat.timeline.threadButton(root).click();
  await bobChat.threads.expectOpen();

  await test.step("the thread opens on its latest replies", async () => {
    await bobChat.threads.timeline.expectMessage(`${reply} [60]`);
    await Promise.all(pages);
    expect(reachedRoot).toBe(false);
    await expect(bobChat.threads.timeline.message(root)).toHaveCount(0);
  });

  await test.step("older replies load while scrolling up", async () => {
    await bobChat.threads.timeline.expectMessageAbove(root);
    await bobChat.threads.timeline.expectMessage(`${reply} [1]`);
    await Promise.all(pages);
    expect(reachedRoot).toBe(true);
  });
});
