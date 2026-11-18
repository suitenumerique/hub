import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom, verifyHubDevice } from "./utils/flows";
import { downloadedBytes, testPdf, testTextFile } from "./utils/files";
import { uniqueId, uniqueText } from "./utils/ids";

/** Time left to "New" to open a conversation it should not, before saying it did not. */
const SETTLE_MS = 1_500;

/**
 * Conversations created from "New". The Hub encrypts every room it creates,
 * so each Hub person is verified with their other device first.
 */
test.describe("New conversations", () => {
  test("creates a direct conversation and exchanges encrypted", async ({
    people,
    hub,
    devices,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const aliceChat = await hub.open(alice);
    const bobChat = await hub.open(bob);
    await verifyHubDevice(aliceChat, await devices.start(alice));
    await verifyHubDevice(bobChat, await devices.start(bob));

    const hello = uniqueText("Hello Bob");

    const roomId = await test.step("the first message creates it", async () => {
      await aliceChat.leftPanel.openNewChat();
      await aliceChat.newChat.add(bob);
      await aliceChat.composer.send(hello);
      const created = await aliceChat.expectConversationUrl();
      await aliceChat.timeline.expectMessageOnce(hello);
      await expect(aliceChat.timeline.encryptionNotice).toContainText(
        "Encryption enabled",
      );
      return created;
    });

    await test.step("Bob accepts, reads and replies", async () => {
      await bobChat.openConversation(alice.displayName);
      await bobChat.invitation.accept();
      await bobChat.timeline.expectMessageOnce(hello);
      const reply = uniqueText("Hello Alice");
      await bobChat.composer.send(reply);
      await aliceChat.timeline.expectMessageOnce(reply);
    });

    await test.step("an encrypted file goes each way", async () => {
      const notes = testTextFile(`notes-${uniqueId()}`);
      await aliceChat.composer.attach([notes]);
      await aliceChat.composer.sendAttachments();
      await expect(bobChat.timeline.file(notes.name)).toBeVisible({
        timeout: 20_000,
      });
      const received = await bobChat.timeline.download(notes.name, "file");
      expect(received.suggestedFilename()).toBe(notes.name);
      expect(await downloadedBytes(received)).toEqual(notes.data);

      const report = testPdf(`report-${uniqueId()}`);
      await bobChat.composer.attach([report]);
      await bobChat.composer.sendAttachments();
      await expect(aliceChat.timeline.file(report.name)).toBeVisible({
        timeout: 20_000,
      });
      const back = await aliceChat.timeline.download(report.name, "file");
      expect(await downloadedBytes(back)).toEqual(report.data);
    });

    await test.step("choosing Bob again shows the same conversation", async () => {
      await aliceChat.leftPanel.openNewChat();
      await aliceChat.newChat.add(bob);
      await aliceChat.timeline.expectMessageOnce(hello);
      expect(await alice.api.joinedRooms()).toEqual([roomId]);
    });
  });

  test("choosing someone opens the direct chat, not a named room or former group", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const projectName = uniqueText("Project");
    const projectId = await createUnencryptedRoom(alice, [bob], {
      name: projectName,
    });
    const inProject = uniqueText("In the project");
    await alice.api.sendText(projectId, inProject);
    // A group left down to Alice and Bob.
    const groupId = await createUnencryptedRoom(alice, [bob, carol]);
    const inGroup = uniqueText("In the group");
    await alice.api.sendText(groupId, inGroup);
    await carol.api.leave(groupId);
    const bobChat = await hub.open(bob);
    await bobChat.leftPanel.expectConversation(projectName);

    await test.step("without a direct chat, neither room opens", async () => {
      await bobChat.leftPanel.openNewChat();
      await bobChat.newChat.add(alice);
      await bobChat.page.waitForTimeout(SETTLE_MS);
      await bobChat.timeline.expectNoMessage(inProject);
      await bobChat.timeline.expectNoMessage(inGroup);
    });

    await test.step("the direct chat opens once it exists", async () => {
      const directId = await createUnencryptedRoom(alice, [bob]);
      const inDirect = uniqueText("In the direct chat");
      await alice.api.sendText(directId, inDirect);
      await bobChat.reload();
      await bobChat.leftPanel.expectConversation({ roomId: directId });
      await bobChat.leftPanel.openNewChat();
      await bobChat.newChat.add(alice);
      await bobChat.timeline.expectMessageOnce(inDirect);
    });
  });

  test("creates a group and mentions someone in it", async ({
    people,
    hub,
    devices,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const aliceChat = await hub.open(alice);
    const bobChat = await hub.open(bob);
    await verifyHubDevice(aliceChat, await devices.start(alice));
    await verifyHubDevice(bobChat, await devices.start(bob));

    const hello = uniqueText("Hello everyone");
    await aliceChat.leftPanel.openNewChat();
    await aliceChat.newChat.add(bob);
    await aliceChat.newChat.add(carol);
    await aliceChat.composer.send(hello);
    const roomId = await aliceChat.expectConversationUrl();
    await carol.api.join(roomId);
    const group = { roomId };

    await test.step("the group shows its members", async () => {
      await expect(
        aliceChat.leftPanel.conversation(group),
      ).toHaveAccessibleName(
        new RegExp(
          `${bob.displayName}.*${carol.displayName}|${carol.displayName}.*${bob.displayName}`,
        ),
        { timeout: 20_000 },
      );
      await bobChat.openConversation(group);
      await bobChat.invitation.accept();
      await bobChat.timeline.expectMessageOnce(hello);
      await bobChat.leftPanel.openNewChat();
    });

    await test.step("a mention gives Bob the mention dot", async () => {
      const [firstName] = bob.displayName.split(" ");
      await aliceChat.composer.mention(firstName, bob.displayName);
      await aliceChat.composer.field.press("End");
      await aliceChat.composer.field.pressSequentially("can you look?");
      await aliceChat.composer.field.press("Enter");
      await bobChat.leftPanel.expectMention(group);
    });

    await test.step("Bob sees the mention rendered", async () => {
      await bobChat.openConversation(group);
      const mention = bobChat.timeline
        .message("can you look?")
        .locator(".hub__message-mention");
      await expect(mention).toHaveText(bob.displayName);
      await expect(mention).toHaveAttribute("title", bob.userId);
    });
  });
});
