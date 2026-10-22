import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom, withSyncGap } from "./utils/flows";
import { uniqueText } from "./utils/ids";
import { delayRequests, ROOM_HISTORY_REQUESTS } from "./utils/network";

/** E2E-05: two people chatting live, each in their own browser. */
test("exchanges messages live between two browsers", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const carol = await people.create("Carol");
  await createUnencryptedRoom(alice, [bob]);
  const carolRoomId = await createUnencryptedRoom(carol, [bob]);

  const aliceChat = await hub.open(alice);
  const bobChat = await hub.open(bob);
  await aliceChat.openConversation(bob.displayName);
  await bobChat.openConversation(alice.displayName);

  await test.step("Bob sees Alice typing", async () => {
    await aliceChat.composer.type("Typing something");
    await expect(bobChat.typingIndicator).toHaveText(
      `${alice.displayName} is typing a message…`,
    );
    await aliceChat.composer.field.fill("");
  });

  await test.step("Bob receives Alice's message once", async () => {
    const text = uniqueText("Live message");
    await aliceChat.composer.send(text);
    await bobChat.timeline.expectMessageOnce(text);
    await aliceChat.timeline.expectMessageOnce(text);
  });

  await test.step("the row moves to the top with a dot", async () => {
    await bobChat.openConversation(carol.displayName);
    await carol.api.sendText(carolRoomId, uniqueText("From Carol"));
    await bobChat.leftPanel.expectFirst(carol.displayName);
    const text = uniqueText("While Bob is elsewhere");
    await aliceChat.composer.send(text);
    await bobChat.leftPanel.expectFirst(alice.displayName);
    await bobChat.leftPanel.expectUnread(alice.displayName);
    await aliceChat.timeline.expectMessageOnce(text);
  });

  await test.step("Alice receives Bob's reply live", async () => {
    await bobChat.openConversation(alice.displayName);
    const reply = uniqueText("Reply from Bob");
    await bobChat.composer.send(reply);
    await aliceChat.timeline.expectMessageOnce(reply);
  });
});

/**
 * A message arriving while the first page of a conversation is fetched from
 * the homeserver must still show: the history request is slowed down to hit
 * that window every time.
 */
test("shows a message that arrives while the conversation loads", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  const older = uniqueText("Older message");
  await alice.api.sendText(roomId, older);
  // Without messages in the events synced first, the first page has to be
  // fetched from the homeserver.
  for (let index = 0; index < 25; index++) {
    await alice.api.sendState(roomId, "m.room.topic", { topic: `${index}` });
  }

  const bobChat = await hub.open(bob);
  await bobChat.leftPanel.expectConversation(alice.displayName);
  const history = await delayRequests(
    bobChat.page,
    ROOM_HISTORY_REQUESTS,
    4_000,
  );
  await bobChat.leftPanel.conversation(alice.displayName).click();
  await history.held;
  const live = uniqueText("Sent while loading");
  await alice.api.sendText(roomId, live);

  await bobChat.timeline.expectMessage(older);
  await bobChat.timeline.expectMessageOnce(live);
});

/**
 * A sync that returns fewer events than were sent ("limited") leaves a gap the
 * Hub has to fill itself, as after a frozen tab or a slow homeserver.
 */
test("shows every message after a sync with a gap", async ({ people, hub }) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const roomId = await createUnencryptedRoom(alice, [bob]);
  const bobChat = await hub.open(bob);
  await bobChat.openConversation(alice.displayName);

  const prefix = uniqueText("During the gap");
  await withSyncGap(bobChat, roomId, {
    wake: () => alice.api.sendText(roomId, uniqueText("Before the gap")),
    write: () => alice.api.sendMany(roomId, prefix, 25),
  });

  await bobChat.timeline.expectMessageOnce(`${prefix} [25]`);
  await bobChat.timeline.expectMessageAbove(`${prefix} [1]`);
  await bobChat.timeline.expectMessageOnce(`${prefix} [1]`);
});
