import { expect, test } from "./utils/fixtures";
import { uniqueText } from "./utils/ids";

/** E2E-09 and E2E-18: conversations Bob was invited to by Alice. */
test.describe("Invitations", () => {
  test("accepts an invitation and joins the conversation", async ({
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
    const text = uniqueText("Before accepting");
    await alice.api.sendText(roomId, text);

    await bobChat.openConversation(alice.displayName);
    await bobChat.invitation.expectFrom(alice.displayName);
    await expect(bobChat.composer.field).toBeHidden();

    await bobChat.invitation.accept();
    await bobChat.timeline.expectMessage(text);
    await bobChat.expectConversationUrl(roomId);
    const reply = uniqueText("After accepting");
    await bobChat.composer.send(reply);
    await alice.api.waitForText(roomId, reply);
  });

  test("dismisses an invitation for good", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const bobChat = await hub.open(bob);
    const roomId = await alice.api.createRoom({
      invite: [bob.userId],
      isDirect: true,
    });

    await bobChat.openConversation(alice.displayName);
    await bobChat.invitation.dismiss();
    await bobChat.leftPanel.expectNoConversation(alice.displayName);
    await alice.api.waitForMembership(roomId, bob.userId, "leave");

    await bobChat.reload();
    await bobChat.leftPanel.expectNoConversation(alice.displayName);
  });

  test("a new chat with someone who already invited me accepts it", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await alice.api.createRoom({
      invite: [bob.userId],
      isDirect: true,
    });
    const text = uniqueText("Waiting for Bob");
    await alice.api.sendText(roomId, text);

    const bobChat = await hub.open(bob);
    await bobChat.leftPanel.expectConversation(alice.displayName);
    await bobChat.leftPanel.openNewChat();
    await bobChat.newChat.add(alice);
    await bobChat.newChat.confirm();

    await bobChat.timeline.expectMessage(text);
    await expect.poll(() => bob.api.joinedRooms()).toEqual([roomId]);
    expect(await bob.api.invitedRooms()).toEqual([]);

    const reply = uniqueText("Joined from New");
    await bobChat.composer.send(reply);
    await bobChat.expectConversationUrl(roomId);
    await alice.api.waitForText(roomId, reply);
  });
});
