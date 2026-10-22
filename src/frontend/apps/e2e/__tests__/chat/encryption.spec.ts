import { VerificationPhase } from "matrix-js-sdk/lib/crypto-api";

import { expect, test } from "./utils/fixtures";
import {
  createEncryptedRoom,
  markRoomRead,
  shownDeviceId,
  verifyHubDevice,
  withSyncGap,
} from "./utils/flows";
import { uniqueText } from "./utils/ids";
import { stashToDeviceMessages } from "./utils/network";

const ENCRYPTED_PLACEHOLDER =
  /Encrypted message (unavailable|awaiting decryption)/;

/** E2E-10 and E2E-11: the Hub as a new device of an encrypted account. */
test.describe("Encryption", () => {
  test("verifies the Hub with the person's other device", async ({
    people,
    hub,
    devices,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const alicePhone = await devices.start(alice);
    const roomId = await createEncryptedRoom(alicePhone, [bob.api]);

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);

    await test.step("sending is blocked before verification", async () => {
      await expect(
        chat.page.getByText("Set up encryption to send messages."),
      ).toBeVisible();
      await chat.composer.expectBlocked();
    });

    await test.step("emojis that do not match cancel it", async () => {
      await chat.encryption.openFromComposer();
      await chat.encryption.expectDeviceStatus("Verification required");
      await chat.encryption.startVerification();
      const sas = await alicePhone.acceptVerification();
      expect(await chat.encryption.shownEmojis()).toEqual(sas.emojis);
      await chat.encryption.theyDoNotMatch();
      await chat.encryption.expectText(
        "The symbols do not match. Verification has been cancelled.",
      );
      expect(await sas.finished).toBe(VerificationPhase.Cancelled);
      await chat.encryption.expectDeviceStatus("Verification required");
      await chat.encryption.close();
      await chat.composer.expectBlocked();
    });

    await test.step("matching emojis verify it", async () => {
      await chat.encryption.openFromComposer();
      await chat.encryption.startVerification();
      const sas = await alicePhone.acceptVerification();
      expect(await chat.encryption.shownEmojis()).toEqual(sas.emojis);
      await chat.encryption.theyMatch();
      await sas.confirm();
      expect(await sas.finished).toBe(VerificationPhase.Done);
      await chat.encryption.expectDeviceStatus("Verified");
      await chat.encryption.expectBackupStatus("Active");
      await chat.encryption.close();
      await chat.composer.expectUsable();
    });

    await test.step("the other device decrypts what the Hub sends", async () => {
      const text = uniqueText("Sent once verified");
      await chat.composer.send(text);
      await alicePhone.waitForText(roomId, text);
      expect(
        await alicePhone.isOwnDeviceVerified(await shownDeviceId(chat)),
      ).toBe(true);
    });
  });

  test("restores the encrypted history from the key backup", async ({
    people,
    hub,
    devices,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const alicePhone = await devices.start(alice);
    const bobPhone = await devices.start(bob);
    const roomId = await createEncryptedRoom(bobPhone, [alicePhone]);
    const before = uniqueText("Before the Hub");
    await bobPhone.sendText(roomId, before);
    await alicePhone.waitForText(roomId, before);
    await alicePhone.waitForBackedUpKeys(roomId);

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);

    await test.step("the message is unreadable on the new device", async () => {
      await expect(
        chat.timeline.messages().filter({ hasText: ENCRYPTED_PLACEHOLDER }),
      ).toHaveCount(1, { timeout: 20_000 });
      await chat.timeline.expectNoMessage(before);
    });

    await test.step("verification restores it from the backup", async () => {
      await verifyHubDevice(chat, alicePhone);
      await chat.timeline.expectMessageOnce(before);
    });

    await test.step("the device stays verified after a reload", async () => {
      await chat.reload();
      await chat.openConversation(bob.displayName);
      await chat.timeline.expectMessageOnce(before);
      await chat.composer.expectUsable();
      await chat.accountMenu.choose("Encryption");
      await chat.encryption.expectDeviceStatus("Verified");
      await chat.encryption.expectBackupStatus("Active");
    });
  });
});

/** Encrypted messages received in unusual orders still end up readable. */
test.describe("Receiving encrypted messages", () => {
  test("decrypts every message after a sync with a gap", async ({
    people,
    hub,
    devices,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const alicePhone = await devices.start(alice);
    const roomId = await createEncryptedRoom(alicePhone, [bob.api]);
    const bobChat = await hub.open(bob);
    await bobChat.openConversation(alice.displayName);

    const prefix = uniqueText("Encrypted during the gap");
    await withSyncGap(bobChat, roomId, {
      wake: () => alicePhone.sendText(roomId, uniqueText("Before the gap")),
      write: async () => {
        for (let index = 1; index <= 25; index++) {
          await alicePhone.sendText(roomId, `${prefix} [${index}]`);
        }
      },
    });

    await bobChat.timeline.expectMessageOnce(`${prefix} [25]`);
    await bobChat.timeline.expectMessageAbove(`${prefix} [1]`);
    await expect(
      bobChat.timeline.messages().filter({ hasText: ENCRYPTED_PLACEHOLDER }),
    ).toHaveCount(0);
  });

  test("shows a message whose key arrives after it", async ({
    people,
    hub,
    devices,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const alicePhone = await devices.start(alice);
    const roomId = await createEncryptedRoom(alicePhone, [bob.api]);
    const bobChat = await hub.open(bob);
    await bobChat.openConversation(alice.displayName);

    const keys = await stashToDeviceMessages(bobChat.page);
    await markRoomRead(alice, roomId);
    await keys.intercepting;
    const text = uniqueText("Key arriving late");
    const eventId = await alicePhone.sendText(roomId, text);
    await expect(
      bobChat.timeline.messages().filter({ hasText: ENCRYPTED_PLACEHOLDER }),
    ).toHaveCount(1, { timeout: 20_000 });

    keys.deliver();
    // Any event ends the sync in flight, which then brings the key.
    await alice.api.markRead(roomId, eventId);
    await bobChat.timeline.expectMessageOnce(text);
    await expect(
      bobChat.timeline.messages().filter({ hasText: ENCRYPTED_PLACEHOLDER }),
    ).toHaveCount(0);
  });
});
