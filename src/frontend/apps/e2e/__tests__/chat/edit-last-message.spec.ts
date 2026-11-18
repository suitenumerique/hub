import { expect, test } from "./utils/fixtures";
import { testPdf } from "./utils/files";
import { createUnencryptedRoom } from "./utils/flows";
import { uniqueText } from "./utils/ids";
import type { Composer } from "./utils/pages/composer";

/** Start and end of the selection in the field of `composer`. */
const selectionOf = (composer: Composer) =>
  composer.field.evaluate((input: HTMLTextAreaElement) => [
    input.selectionStart,
    input.selectionEnd,
  ]);

/** E2E-23: the up arrow of the empty composer edits one's last message. */
test.describe("Editing the last message with the up arrow", () => {
  test("opens the last message of mine in a conversation", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const greeting = uniqueText("Hello");
    await bob.api.sendText(roomId, greeting);

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.timeline.expectMessage(greeting);
    const { composer } = chat;

    await test.step("without a message of mine, nothing opens", async () => {
      await composer.field.click();
      await composer.field.press("ArrowUp");
      await expect(composer.editingStatus).toBeHidden();
      await expect(composer.field).toHaveValue("");
    });

    // Sent from another device of Alice, as from Tchap: her file and Bob's
    // answer come after her last text.
    const older = uniqueText("Older message");
    const last = uniqueText("Last message");
    const answer = uniqueText("Bob's answer");
    await alice.api.sendText(roomId, older);
    await alice.api.sendText(roomId, last);
    await alice.api.sendFile(roomId, testPdf(uniqueText("Report")));
    await bob.api.sendText(roomId, answer);
    await chat.timeline.expectMessage(answer);

    await test.step("the up arrow opens the last text of mine", async () => {
      await composer.field.press("ArrowUp");
      await expect(composer.editingStatus).toBeVisible();
      await expect(composer.field).toHaveValue(last);
      await expect
        .poll(() => selectionOf(composer))
        .toEqual([last.length, last.length]);
    });

    await test.step("pressed again, it goes to the start of the text", async () => {
      await composer.field.press("ArrowUp");
      await expect.poll(() => selectionOf(composer)).toEqual([0, 0]);
      // No older message opens.
      await expect(composer.editingStatus).toBeVisible();
      await expect(composer.field).toHaveValue(last);
    });

    const edited = uniqueText("Edited");

    await test.step("the edit is saved as one from the menu", async () => {
      await composer.field.fill(edited);
      await composer.field.press("Enter");
      await expect(composer.editingStatus).toBeHidden();
      await chat.timeline.expectEdited(edited);
      await expect(composer.field).toHaveValue("");
    });

    await test.step("Escape leaves the composer empty again", async () => {
      await composer.field.press("ArrowUp");
      await expect(composer.field).toHaveValue(edited);
      await composer.field.press("Escape");
      await expect(composer.editingStatus).toBeHidden();
      await expect(composer.field).toHaveValue("");
    });

    await test.step("with text typed, the up arrow stays in it", async () => {
      const draft = uniqueText("Draft");
      await composer.type(draft);
      await composer.field.press("ArrowUp");
      await expect(composer.editingStatus).toBeHidden();
      await expect(composer.field).toHaveValue(draft);
    });
  });

  test("opens the last reply of mine in a thread", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const root = uniqueText("Thread root");
    const rootId = await bob.api.sendText(roomId, root);
    const reply = uniqueText("Alice's reply");
    const answer = uniqueText("Bob's answer");
    await alice.api.sendText(roomId, reply, { threadRootId: rootId });
    await bob.api.sendText(roomId, answer, { threadRootId: rootId });

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.timeline.expectMessage(root);

    await test.step("the conversation composer leaves replies out", async () => {
      await chat.composer.field.click();
      await chat.composer.field.press("ArrowUp");
      await expect(chat.composer.editingStatus).toBeHidden();
      await expect(chat.composer.field).toHaveValue("");
    });

    const { composer } = chat.threads;

    await test.step("the thread composer opens the last reply of mine", async () => {
      await chat.timeline.threadButton(root).click();
      await chat.threads.expectThread(root);
      await chat.threads.timeline.expectMessage(answer);
      await composer.field.click();
      await composer.field.press("ArrowUp");
      await expect(composer.editingStatus).toBeVisible();
      await expect(composer.field).toHaveValue(reply);
      await expect(chat.composer.editingStatus).toBeHidden();
    });

    await test.step("the edit is saved in the thread", async () => {
      const edited = uniqueText("Edited reply");
      await composer.field.fill(edited);
      await composer.field.press("Enter");
      await expect(composer.editingStatus).toBeHidden();
      await chat.threads.timeline.expectEdited(edited);
    });
  });
});
