import { expect, test } from "./utils/fixtures";
import {
  createEncryptedRoom,
  createUnencryptedRoom,
  verifyHubDevice,
} from "./utils/flows";
import { uniqueId } from "./utils/ids";

/** E2E-01: sending a message, the journey every other one relies on. */
test.describe("Send a message", () => {
  test("sends a formatted message in an unencrypted conversation", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const id = uniqueId();
    const typed = `Hello **bold ${id}** and [docs](https://example.org/${id})`;

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.composer.send(typed);

    await test.step("the bubble shows once, formatted", async () => {
      const bubble = chat.timeline.message(`bold ${id}`);
      await expect(bubble.locator("strong")).toHaveText(`bold ${id}`);
      await expect(bubble.getByRole("link", { name: "docs" })).toHaveAttribute(
        "href",
        `https://example.org/${id}`,
      );
      await expect(bubble.getByRole("link", { name: "docs" })).toHaveAttribute(
        "target",
        "_blank",
      );
    });

    await test.step("Bob receives the exact text and formatting", async () => {
      const received = await bob.api.waitForText(roomId, typed);
      expect(received.sender).toBe(alice.userId);
      expect(received.content.formatted_body).toContain(
        `<strong>bold ${id}</strong>`,
      );
      expect(received.content.formatted_body).toContain(
        `<a href="https://example.org/${id}">docs</a>`,
      );
    });

    await test.step("the server echo does not duplicate it", async () => {
      await chat.timeline.expectMessageOnce(`bold ${id}`);
    });

    await test.step("the message is still there after a reload", async () => {
      await chat.reload();
      await chat.openConversation(bob.displayName);
      await chat.timeline.expectMessageOnce(`bold ${id}`);
    });
  });

  test("sends a message in an encrypted conversation", async ({
    people,
    hub,
    devices,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const alicePhone = await devices.start(alice);
    const bobPhone = await devices.start(bob);
    const roomId = await createEncryptedRoom(bobPhone, [alice.api]);

    const chat = await hub.open(alice);
    await verifyHubDevice(chat, alicePhone);
    await chat.openConversation(bob.displayName);
    await expect(chat.timeline.encryptionNotice).toContainText(
      "Encryption enabled",
    );

    const text = `Encrypted hello ${uniqueId()}`;
    await chat.composer.send(text);
    await chat.timeline.expectMessageOnce(text);

    await test.step("Bob's device decrypts it", async () => {
      const received = await bobPhone.waitForText(roomId, text);
      expect(received.getSender()).toBe(alice.userId);
    });

    await test.step("the message is still readable after a reload", async () => {
      await chat.reload();
      await chat.openConversation(bob.displayName);
      await chat.timeline.expectMessageOnce(text);
    });
  });
});
