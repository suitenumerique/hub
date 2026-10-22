import { expect, test } from "./utils/fixtures";
import {
  createUnencryptedRoom,
  shownDeviceId,
  signInAgain,
} from "./utils/flows";
import { readMatrixSession, watchMasRequests } from "./utils/hub-session";
import { uniqueText } from "./utils/ids";
import { ChatPage } from "./utils/pages/chat-page";
import {
  ANOTHER_TAB_MESSAGE,
  ConnectionError,
} from "./utils/pages/connection-error";

/** E2E-03: a reload restores the session without signing in again. */
test("restores the chat session on reload", async ({ people, hub }) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  await createUnencryptedRoom(alice, [bob]);

  const chat = await hub.open(alice);
  const masRequests = watchMasRequests(chat.page);
  await chat.openConversation(bob.displayName);
  const text = uniqueText("Before reload");
  await chat.composer.send(text);
  await chat.timeline.expectMessageOnce(text);

  await chat.reload();
  await chat.leftPanel.expectConversation(bob.displayName);
  await chat.openConversation(bob.displayName);
  await chat.timeline.expectMessageOnce(text);
  expect(masRequests).toEqual([]);
});

/** E2E-04: logging out keeps the device, and never leaks to the next person. */
test("logs out, signs in again, then hands the browser to someone else", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const carol = await people.create("Carol");
  const dave = await people.create("Dave");
  await createUnencryptedRoom(alice, [carol]);
  await createUnencryptedRoom(bob, [dave]);

  const aliceChat = await hub.open(alice);
  await aliceChat.leftPanel.expectConversation(carol.displayName);
  const deviceId = await shownDeviceId(aliceChat);

  await test.step("Alice logs out and comes back to the same device", async () => {
    await aliceChat.accountMenu.logout();
    // The Matrix session stays in the browser: signing in again skips MAS.
    expect((await readMatrixSession(aliceChat.page, alice))?.deviceId).toBe(
      deviceId,
    );
    const masRequests = watchMasRequests(aliceChat.page);
    await signInAgain(aliceChat);
    await aliceChat.leftPanel.expectConversation(carol.displayName);
    expect(await shownDeviceId(aliceChat)).toBe(deviceId);
    expect(masRequests).toEqual([]);
    await aliceChat.accountMenu.logout();
  });

  await test.step("Bob, on the same computer, sees none of it", async () => {
    const bobChat = await hub.open(bob, { context: aliceChat.page.context() });
    await bobChat.leftPanel.expectConversation(dave.displayName);
    await expect(bobChat.leftPanel.conversation(carol.displayName)).toHaveCount(
      0,
    );
    await expect(bobChat.leftPanel.rows()).toHaveCount(1);
  });
});

/** E2E-16: one Hub tab at a time owns the encrypted session. */
test("blocks a second tab until the first one is closed", async ({
  people,
  hub,
}) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  await createUnencryptedRoom(alice, [bob]);
  const firstTab = await hub.open(alice);

  const secondPage = await firstTab.page.context().newPage();
  await secondPage.goto("/chat/new");
  const blocked = new ConnectionError(secondPage);
  await blocked.expectShown(ANOTHER_TAB_MESSAGE);

  await test.step("the first tab stays usable", async () => {
    await firstTab.openConversation(bob.displayName);
    const text = uniqueText("Still usable");
    await firstTab.composer.send(text);
    await bob.api.waitForText(firstTab.currentRoomId()!, text);
  });

  await test.step("closing the first tab frees the session", async () => {
    await firstTab.page.close();
    await blocked.tryAgainButton.click();
    const secondTab = new ChatPage(secondPage, alice);
    await secondTab.leftPanel.expectReady();
    await secondTab.leftPanel.expectConversation(bob.displayName);
  });
});
