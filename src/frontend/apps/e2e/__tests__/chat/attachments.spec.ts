import { expect, test } from "./utils/fixtures";
import { downloadedBytes, IMAGE_SIZE, testImage, testPdf } from "./utils/files";
import { createUnencryptedRoom } from "./utils/flows";
import { uniqueId } from "./utils/ids";

/** E2E-13: files in an unencrypted conversation, sent and received. */
test.describe("Attachments", () => {
  test("sends an image and a PDF that arrive intact", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const image = testImage(`photo-${uniqueId()}`);
    const pdf = testPdf(`report-${uniqueId()}`);

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.composer.attach([image, pdf]);
    await chat.composer.sendAttachments();
    await expect(chat.timeline.image(image.name)).toBeVisible();
    await expect(chat.timeline.file(pdf.name)).toBeVisible();

    for (const [file, msgtype] of [
      [image, "m.image"],
      [pdf, "m.file"],
    ] as const) {
      const event = await bob.api.waitForEvent(
        roomId,
        (candidate) => candidate.content.body === file.name,
      );
      expect(event.content.msgtype).toBe(msgtype);
      expect(await bob.api.download(String(event.content.url))).toEqual(
        file.data,
      );
    }

    await test.step("Alice's own file shows her as the sender", async () => {
      await chat.timeline.image(image.name).click();
      await chat.preview.expectOpen(image.name.replace(/\.png$/, ""));
      await expect(await chat.preview.detail("Sent by")).toHaveText("You");
      await chat.preview.close();
    });
  });

  test("previews and downloads received files", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const image = testImage(`photo-${uniqueId()}`);
    const pdf = testPdf(`report-${uniqueId()}`);
    await bob.api.sendFile(roomId, image, { w: IMAGE_SIZE, h: IMAGE_SIZE });
    await bob.api.sendFile(roomId, pdf);

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);

    await test.step("the image has a thumbnail and a preview", async () => {
      const thumbnail = chat.timeline.image(image.name);
      await expect(thumbnail.locator("img")).toBeVisible();
      await thumbnail.click();
      await chat.preview.expectOpen(image.name.replace(/\.png$/, ""));
      await expect(await chat.preview.detail("Sent by")).toHaveText(
        bob.displayName,
      );
      const download = await chat.preview.download();
      expect(download.suggestedFilename()).toBe(image.name);
      expect(await downloadedBytes(download)).toEqual(image.data);
      await chat.preview.close();
    });

    await test.step("the PDF opens and downloads intact", async () => {
      await chat.timeline.file(pdf.name).click();
      await chat.preview.expectOpen(pdf.name.replace(/\.pdf$/, ""));
      const download = await chat.preview.download();
      expect(await downloadedBytes(download)).toEqual(pdf.data);
      await chat.preview.close();
      const fromMenu = await chat.timeline.download(pdf.name, "file");
      expect(fromMenu.suggestedFilename()).toBe(pdf.name);
      expect(await downloadedBytes(fromMenu)).toEqual(pdf.data);
    });
  });
});
