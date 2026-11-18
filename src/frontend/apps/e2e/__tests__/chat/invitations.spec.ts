import { SYNC_TIMEOUT } from "./utils/env";
import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom } from "./utils/flows";
import { uniqueText } from "./utils/ids";
import type { ChatPage } from "./utils/pages/chat-page";

/** The chat list, top to bottom, by row name. */
const expectOrder = async (chat: ChatPage, names: string[]): Promise<void> => {
  await expect
    .poll(
      () =>
        chat.leftPanel
          .rows()
          .getByRole("link")
          .evaluateAll((links) =>
            links.map((link) => link.getAttribute("aria-label")),
          ),
      { timeout: SYNC_TIMEOUT },
    )
    .toEqual(names);
};

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

  test("declines an invitation for good", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const bobChat = await hub.open(bob);
    const roomId = await alice.api.createRoom({
      invite: [bob.userId],
      isDirect: true,
    });

    await bobChat.openConversation(alice.displayName);
    await bobChat.invitation.decline();
    await bobChat.leftPanel.expectNoConversation(alice.displayName);
    await alice.api.waitForMembership(roomId, bob.userId, "leave");

    await bobChat.reload();
    await bobChat.leftPanel.expectNoConversation(alice.displayName);
  });

  test("accepts a new invitation to a chat left before", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const before = uniqueText("Before leaving");
    await alice.api.sendText(roomId, before);
    const bobChat = await hub.open(bob);
    await bobChat.openConversation(alice.displayName);
    await bobChat.timeline.expectMessage(before);
    await bobChat.header.leave(alice.displayName);
    await alice.api.waitForMembership(roomId, bob.userId, "leave");

    // The chat then opens on this first unread message.
    const whileAway = uniqueText("While Bob was away");
    await alice.api.sendText(roomId, whileAway);
    await alice.api.invite(roomId, bob.userId);
    await bobChat.openConversation(alice.displayName);
    await bobChat.invitation.accept();
    await bobChat.timeline.expectMessage(whileAway);
    await bobChat.timeline.expectMessageAbove(before);
  });

  test("lists invitations above newer activity", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const dave = await people.create("Dave");
    const carolRoomId = await createUnencryptedRoom(carol, [bob]);
    await carol.api.sendText(carolRoomId, uniqueText("Before"));
    const bobChat = await hub.open(bob);
    await expectOrder(bobChat, [carol.displayName]);

    await test.step("a new invitation shows at the top", async () => {
      await alice.api.createRoom({ invite: [bob.userId], isDirect: true });
      await expectOrder(bobChat, [alice.displayName, carol.displayName]);
    });

    await test.step("newer activity stays below every invitation", async () => {
      await dave.api.createRoom({ invite: [bob.userId], isDirect: true });
      await expectOrder(bobChat, [
        dave.displayName,
        alice.displayName,
        carol.displayName,
      ]);
      const after = uniqueText("After");
      await carol.api.sendText(carolRoomId, after);
      await bobChat.openConversation(carol.displayName);
      await bobChat.timeline.expectMessage(after);
      await expectOrder(bobChat, [
        dave.displayName,
        alice.displayName,
        carol.displayName,
      ]);
    });

    await test.step("the list read again after a reload agrees", async () => {
      await bobChat.reload();
      await expectOrder(bobChat, [
        dave.displayName,
        alice.displayName,
        carol.displayName,
      ]);
    });

    await test.step("an accepted invitation takes its place by activity", async () => {
      await bobChat.openConversation(alice.displayName);
      await bobChat.invitation.accept();
      await carol.api.sendText(carolRoomId, uniqueText("Latest"));
      await expectOrder(bobChat, [
        dave.displayName,
        carol.displayName,
        alice.displayName,
      ]);
    });
  });

  test("finds invitations in search, above the other results", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    await createUnencryptedRoom(alice, [bob]);
    const roomName = uniqueText("Project");
    await alice.api.createRoom({ name: roomName, invite: [bob.userId] });
    const bobChat = await hub.open(bob);
    await bobChat.leftPanel.expectConversation(roomName);

    await bobChat.search.open();
    // Found by its inviter, before the direct chat with her.
    await bobChat.search.search(alice.displayName);
    await bobChat.search.expectResult(alice.displayName);
    await bobChat.search.expectResult(roomName);
    await bobChat.search.expectFirstResult(roomName);
    await bobChat.search.search(roomName);
    await bobChat.search.expectResult(roomName);
    await bobChat.search.openResult(roomName);
    await bobChat.invitation.expectFrom(alice.displayName);
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
