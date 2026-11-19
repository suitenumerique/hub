import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom } from "./utils/flows";
import { uniqueText } from "./utils/ids";
import type { Composer } from "./utils/pages/composer";

/** Start and end of the selection in the field of `composer`. */
const selectionOf = (composer: Composer) =>
  composer.field.evaluate((input: HTMLTextAreaElement) => [
    input.selectionStart,
    input.selectionEnd,
  ]);

/** E2E-24: emoji are inserted from a picker or a `:shortcode` (#146). */
test.describe("Inserting emoji in the composer", () => {
  test("inserts the emoji picked from the picker at the caret", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    await createUnencryptedRoom(alice, [bob]);

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    const { composer } = chat;
    const start = uniqueText("Well done");
    const end = " team";
    // The caret goes back before " team", where the emoji must land.
    await composer.type(`${start}${end}`);
    for (let index = 0; index < end.length; index += 1) {
      await composer.field.press("ArrowLeft");
    }
    const caret = [start.length, start.length];

    await test.step("Escape closes the picker, the draft unchanged", async () => {
      await composer.emojiButton.click();
      await expect(composer.emojiSearch).toBeFocused();
      await composer.emojiSearch.press("Escape");
      await expect(composer.emojiPicker).toBeHidden();
      await expect(composer.field).toBeFocused();
      await expect(composer.field).toHaveValue(`${start}${end}`);
      await expect.poll(() => selectionOf(composer)).toEqual(caret);
    });

    await test.step("Tab out of the picker goes back to the text", async () => {
      for (const key of ["Tab", "Shift+Tab"]) {
        await composer.emojiButton.click();
        await expect(composer.emojiSearch).toBeFocused();
        await composer.emojiSearch.press(key);
        await expect(composer.emojiPicker).toBeHidden();
        await expect(composer.field).toBeFocused();
        await expect.poll(() => selectionOf(composer)).toEqual(caret);
      }
    });

    await test.step("a click outside closes it too", async () => {
      await composer.emojiButton.click();
      await expect(composer.emojiPicker).toBeVisible();
      await chat.timeline.encryptionNotice.click();
      await expect(composer.emojiPicker).toBeHidden();
      await expect(composer.field).toHaveValue(`${start}${end}`);
    });

    await test.step("its button closes it, back to the text", async () => {
      await composer.emojiButton.click();
      await expect(composer.emojiSearch).toBeFocused();
      await composer.emojiButton.click();
      await expect(composer.emojiPicker).toBeHidden();
      await expect(composer.field).toBeFocused();
      await expect.poll(() => selectionOf(composer)).toEqual(caret);
    });

    const sent = `${start}🎉${end}`;

    await test.step("the picked emoji lands at the caret", async () => {
      await composer.pickEmoji("party popper");
      await expect(composer.field).toHaveValue(sent);
      await expect(composer.field).toBeFocused();
      // Right after the emoji, two UTF-16 units long.
      await expect
        .poll(() => selectionOf(composer))
        .toEqual([start.length + 2, start.length + 2]);
    });

    await test.step("it is sent with the text", async () => {
      await composer.sendDraft();
      await chat.timeline.expectMessage(sent);
    });
  });

  test("replaces a :shortcode with its emoji", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    await createUnencryptedRoom(alice, [bob]);

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    const { composer } = chat;
    const text = uniqueText("Release");

    await test.step("one character after the colon offers nothing", async () => {
      await composer.type(`${text} :t`);
      await expect(composer.emojiSuggestions).toBeHidden();
    });

    await test.step("Enter replaces the shortcode, without sending", async () => {
      await composer.field.pressSequentially("ad", { delay: 30 });
      await expect(composer.emojiSuggestion("tada")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      // The focus stays in the text: screen readers hear the list open.
      await expect(composer.suggestionsStatus).toHaveText(
        /^1 emoji suggestions?, use the arrow keys to choose$/,
      );
      await composer.field.press("Enter");
      await expect(composer.emojiSuggestions).toBeHidden();
      await expect(composer.suggestionsStatus).toHaveCount(0);
      await expect(composer.field).toHaveValue(`${text} 🎉`);
    });

    await test.step("the arrows and Tab pick another row", async () => {
      await composer.field.pressSequentially(" :thumbs", { delay: 30 });
      await expect(composer.emojiSuggestion("thumbsup")).toBeVisible();
      await expect(composer.emojiSuggestion("thumbsdown")).toBeVisible();
      await composer.field.press("ArrowDown");
      await expect(composer.emojiSuggestion("thumbsdown")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await composer.field.press("Tab");
      await expect(composer.field).toHaveValue(`${text} 🎉 👎`);
      await expect(composer.field).toBeFocused();
    });

    await test.step("a row can be clicked", async () => {
      await composer.field.pressSequentially(" :heart_ey", { delay: 30 });
      await composer.emojiSuggestion("heart_eyes").click();
      await expect(composer.field).toHaveValue(`${text} 🎉 👎 😍`);
      await expect(composer.field).toBeFocused();
    });

    await test.step("Escape and a space leave the text as typed", async () => {
      await composer.field.pressSequentially(" :smi", { delay: 30 });
      await expect(composer.emojiSuggestion("smile")).toBeVisible();
      await composer.field.press("Escape");
      await expect(composer.emojiSuggestions).toBeHidden();
      // Typing on brings the list back; a space closes it.
      await composer.field.pressSequentially("l", { delay: 30 });
      await expect(composer.emojiSuggestion("smile")).toBeVisible();
      await composer.field.pressSequentially(" ", { delay: 30 });
      await expect(composer.emojiSuggestions).toBeHidden();
      await expect(composer.field).toHaveValue(`${text} 🎉 👎 😍 :smil `);
    });

    await test.step("no list without a match or inside a word", async () => {
      await composer.field.pressSequentially(":zzqx at 10:30", { delay: 30 });
      await expect(composer.emojiSuggestions).toBeHidden();
    });

    await test.step("the @ suggestions are announced as well", async () => {
      await composer.field.pressSequentially(" @Bob", { delay: 30 });
      await expect(composer.mentionSuggestions).toBeVisible();
      await expect(composer.suggestionsStatus).toHaveText(
        /^1 mention suggestions?, use the arrow keys to choose$/,
      );
      await composer.field.press("Escape");
      await expect(composer.suggestionsStatus).toHaveCount(0);
    });

    await test.step("a word glued after the shortcode stays", async () => {
      await composer.field.pressSequentially(" end", { delay: 30 });
      for (let index = 0; index < "end".length; index += 1) {
        await composer.field.press("ArrowLeft");
      }
      await composer.field.pressSequentially(":tad", { delay: 30 });
      await composer.emojiSuggestion("tada").click();
      await expect(composer.field).toHaveValue(
        `${text} 🎉 👎 😍 :smil :zzqx at 10:30 @Bob 🎉end`,
      );
    });

    await test.step("a closed shortcode leaves the next one alone", async () => {
      await composer.field.press("End");
      await composer.field.pressSequentially(" :heart:", { delay: 30 });
      for (let index = 0; index < ":heart:".length; index += 1) {
        await composer.field.press("ArrowLeft");
      }
      await composer.field.pressSequentially(":tada:", { delay: 30 });
      await expect(composer.emojiSuggestion("tada")).toBeVisible();
      await composer.field.press("Enter");
      await expect(composer.field).toHaveValue(
        `${text} 🎉 👎 😍 :smil :zzqx at 10:30 @Bob 🎉end 🎉:heart:`,
      );
    });

    await test.step("the emojis are sent as text", async () => {
      await composer.sendDraft();
      await chat.timeline.expectMessage(
        `${text} 🎉 👎 😍 :smil :zzqx at 10:30 @Bob 🎉end 🎉:heart:`,
      );
    });
  });

  test("works in reactions, while editing and in a thread", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const mine = uniqueText("Mine");
    const root = uniqueText("Thread root");
    await alice.api.sendText(roomId, mine);
    await bob.api.sendText(roomId, root);

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.timeline.expectMessage(root);

    await test.step("the reaction picker gives the focus back too", async () => {
      // The same picker, opened from the actions menu of a message.
      const { composer } = chat;
      const menu = await chat.timeline.openActions(root);
      const addReaction = menu.getByRole("button", { name: "Add a reaction" });
      await addReaction.click();
      await expect(composer.emojiSearch).toBeFocused();
      await composer.emojiSearch.press("Escape");
      await expect(composer.emojiPicker).toBeHidden();
      await expect(addReaction).toBeFocused();
    });

    await test.step("the picker adds to the message being edited", async () => {
      const { composer } = chat;
      await composer.field.click();
      await composer.field.press("ArrowUp");
      await expect(composer.editingStatus).toBeVisible();
      await composer.pickEmoji("party popper");
      await expect(composer.field).toHaveValue(`${mine}🎉`);
      await expect(composer.editingStatus).toBeVisible();
    });

    await test.step("Escape on the list keeps the edit going", async () => {
      const { composer } = chat;
      await composer.field.pressSequentially(" :rock", { delay: 30 });
      await expect(composer.emojiSuggestion("rocket")).toBeVisible();
      await composer.field.press("Escape");
      await expect(composer.emojiSuggestions).toBeHidden();
      await expect(composer.editingStatus).toBeVisible();
      await composer.field.pressSequentially("e", { delay: 30 });
      await composer.emojiSuggestion("rocket").click();
      await expect(composer.field).toHaveValue(`${mine}🎉 🚀`);
      await composer.field.press("Enter");
      await expect(composer.editingStatus).toBeHidden();
      await chat.timeline.expectEdited(`${mine}🎉 🚀`);
    });

    await test.step("a thread reply takes a shortcode", async () => {
      await chat.timeline.reply(root);
      await chat.threads.expectOpen();
      const { composer } = chat.threads;
      const reply = uniqueText("Reply");
      await composer.type(`${reply} :tad`);
      await composer.emojiSuggestion("tada").click();
      await expect(composer.field).toHaveValue(`${reply} 🎉`);
      await composer.sendDraft();
      await chat.threads.timeline.expectMessage(`${reply} 🎉`);
    });
  });
});
