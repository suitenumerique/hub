import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom } from "./utils/flows";
import { uniqueText } from "./utils/ids";

/** E2E-15: leaving removes the conversation, and the others see it. */
test("leaves a conversation", async ({ people, hub }) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const roomId = await createUnencryptedRoom(alice, [bob]);

  const chat = await hub.open(alice);
  await chat.openConversation(bob.displayName);
  await chat.header.leave(bob.displayName);

  await expect(chat.page).toHaveURL(/\/chat\/new$/);
  await chat.leftPanel.expectNoConversation(bob.displayName);
  await bob.api.waitForMembership(roomId, alice.userId, "leave");

  await chat.reload();
  await chat.leftPanel.expectNoConversation(bob.displayName);
});

test("keeps the name of a group left with one other person", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const name = uniqueText("Project room");
  // Only Bob is left, as after the others were removed.
  const roomId = await alice.api.createRoom({ name, invite: [bob.userId] });
  await bob.api.join(roomId);

  const chat = await hub.open(alice);
  await chat.leftPanel.expectConversation(name);
  await chat.leftPanel.expectNoConversation(bob.displayName);
  await chat.openConversation(name);
  await chat.header.expectTitle(name);
});
