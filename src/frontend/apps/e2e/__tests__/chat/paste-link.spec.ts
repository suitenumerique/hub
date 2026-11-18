import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom } from "./utils/flows";
import { uniqueId, uniqueText } from "./utils/ids";

/** E2E-22: a URL pasted on selected text links it, as in Slack or Element. */
test.describe("Links pasted in the composer", () => {
  test("links the selected text to the pasted URL", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const label = uniqueText("the doc");
    const url = `https://example.com/${uniqueId()}`;
    const linked = `Read [${label}](${url})`;

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    const { composer } = chat;

    await test.step("the selection becomes the text of a link", async () => {
      await composer.type(`Read ${label}`);
      await composer.selectBeforeCaret(label);
      await composer.paste(url);
      await expect(composer.field).toHaveValue(linked);
    });

    await test.step("one undo gives the selected text back", async () => {
      await composer.field.press("ControlOrMeta+Z");
      await expect(composer.field).toHaveValue(`Read ${label}`);
      await composer.field.press("ControlOrMeta+Shift+Z");
      await expect(composer.field).toHaveValue(linked);
    });

    await test.step("typing goes on after the link", async () => {
      await composer.field.pressSequentially(" today");
      await expect(composer.field).toHaveValue(`${linked} today`);
    });

    await test.step("the sent message shows the link", async () => {
      await composer.sendDraft();
      const link = chat.timeline
        .message(label)
        .getByRole("link", { name: label });
      await expect(link).toHaveAttribute("href", url);
    });

    await test.step("Bob receives the link", async () => {
      const received = await bob.api.waitForText(roomId, `${linked} today`);
      expect(received.content.formatted_body).toContain(
        `<a href="${url}">${label}</a>`,
      );
    });
  });

  test("pastes anything else as usual", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    await createUnencryptedRoom(alice, [bob]);
    const url = `https://example.com/${uniqueId()}`;
    const otherUrl = `https://example.org/${uniqueId()}`;

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    const { composer } = chat;

    await test.step("a URL without a selection is pasted as is", async () => {
      await composer.type("Read ");
      await composer.paste(url);
      await expect(composer.field).toHaveValue(`Read ${url}`);
    });

    await test.step("text that is not a URL replaces the selection", async () => {
      await composer.field.fill("Read the doc");
      await composer.selectBeforeCaret("the doc");
      await composer.paste("the guide");
      await expect(composer.field).toHaveValue("Read the guide");
    });

    await test.step("a name without a scheme is not a URL", async () => {
      await composer.field.fill("Read the doc");
      await composer.selectBeforeCaret("the doc");
      await composer.paste("notes.md");
      await expect(composer.field).toHaveValue("Read notes.md");
    });

    await test.step("a URL pasted on a URL replaces it", async () => {
      await composer.field.fill(`Read ${url}`);
      await composer.selectBeforeCaret(url);
      await composer.paste(otherUrl);
      await expect(composer.field).toHaveValue(`Read ${otherUrl}`);
    });
  });
});
