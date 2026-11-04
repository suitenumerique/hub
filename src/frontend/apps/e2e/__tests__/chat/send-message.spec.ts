import { SYNC_TIMEOUT } from "./utils/env";
import { expect, test } from "./utils/fixtures";
import {
  createEncryptedRoom,
  createUnencryptedRoom,
  verifyHubDevice,
} from "./utils/flows";
import { testPdf } from "./utils/files";
import { uniqueId, uniqueText } from "./utils/ids";
import {
  delayRequests,
  holdRequests,
  SEND_REQUESTS,
  SYNC_REQUESTS,
} from "./utils/network";
import { ChatPage } from "./utils/pages/chat-page";

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

/** Makes the server refuse messages, and hides what the failure logs. */
const refuseSends = async (chat: ChatPage): Promise<void> => {
  // The SDK logs the failure, which opens the dev overlay above the page.
  await chat.page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await chat.page.route(SEND_REQUESTS, (route) =>
    route.fulfill({
      status: 403,
      json: { errcode: "M_FORBIDDEN", error: "Refused" },
    }),
  );
};

const acceptSends = (chat: ChatPage): Promise<void> =>
  chat.page.unroute(SEND_REQUESTS);

/** As when the person moves to another tab. */
const setTabHidden = (chat: ChatPage, isHidden: boolean): Promise<void> =>
  chat.page.evaluate((hidden) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    window.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
  }, isHidden);

/** The same person in a new tab of the same browser, the old one closed. */
const reopenTab = async (chat: ChatPage): Promise<ChatPage> => {
  const context = chat.page.context();
  const url = chat.page.url();
  await chat.page.close();
  const tab = new ChatPage(await context.newPage(), chat.person);
  await tab.goto(url);
  return tab;
};

const bodiesOf = (events: { type: string; content: { body?: unknown } }[]) =>
  events
    .filter(({ type }) => type === "m.room.message")
    .map(({ content }) => content.body);

/** E2E-21: as in Element, a message being sent or refused blocks nothing. */
test.describe("Messages sent in the background", () => {
  test("keeps typing free and the order while messages are sent", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    await createUnencryptedRoom(alice, [carol]);
    const first = uniqueText("First");
    const second = uniqueText("Second");
    const third = uniqueText("Third");
    const forCarol = uniqueText("For Carol");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    const delayed = await delayRequests(chat.page, SEND_REQUESTS, 1_500);
    await chat.composer.field.fill(first);
    await chat.composer.field.press("Enter");
    await expect(chat.composer.field).toHaveValue("");
    await delayed.held;

    await test.step("what is typed during a send is kept", async () => {
      await chat.composer.type(second);
      await expect(chat.composer.field).toHaveValue(second);
    });

    await test.step("another conversation stays free too", async () => {
      await chat.openConversation(carol.displayName);
      await chat.composer.type(forCarol);
      await expect(chat.composer.field).toHaveValue(forCarol);
      await chat.openConversation(bob.displayName);
      await expect(chat.composer.field).toHaveValue(second);
    });

    await test.step("messages sent in a row arrive in order", async () => {
      await chat.composer.field.press("Enter");
      await chat.composer.type(third);
      await chat.composer.field.press("Enter");
      await expect(chat.composer.field).toHaveValue("");
      await chat.timeline.expectMessageOnce(third);
      await bob.api.waitForText(roomId, third);
      const bodies = (await bob.api.messages(roomId))
        .filter(({ type }) => type === "m.room.message")
        .map(({ content }) => content.body);
      expect(bodies).toEqual([third, second, first]);
    });

    await delayed.stop();
  });

  test("keeps a refused message in the conversation until it is sent again", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const refused = uniqueText("Refused");
    const accepted = uniqueText("Accepted");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await refuseSends(chat);
    await chat.composer.send(refused);

    await test.step("it stays with its icon, and the field stays free", async () => {
      await expect(chat.timeline.retryIcon(refused)).toBeVisible();
      await expect(
        chat.page.getByText("Your message could not be sent."),
      ).toBeVisible();
      await expect(chat.composer.field).toHaveValue("");
    });

    await test.step("the next messages go out and it stays below them", async () => {
      await acceptSends(chat);
      await chat.composer.send(accepted);
      await bob.api.waitForText(roomId, accepted);
      await expect(chat.timeline.messages().last()).toContainText(refused);
    });

    await test.step("a reload does not lose it", async () => {
      await chat.reload();
      await expect(chat.timeline.retryIcon(refused)).toBeVisible();
    });

    await test.step("its icon sends it again", async () => {
      await chat.timeline.retryIcon(refused).click();
      await bob.api.waitForText(roomId, refused);
      await chat.timeline.expectMessageOnce(refused);
      await expect(chat.timeline.retryIcon(refused)).toHaveCount(0);
    });

    await test.step("it is an ordinary message afterwards", async () => {
      await chat.reload();
      await chat.timeline.expectMessageOnce(refused);
      await expect(chat.timeline.retryIcon(refused)).toHaveCount(0);
    });
  });

  test("offers to retry or delete a refused message from its menu", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const deleted = uniqueText("Deleted");
    const retried = uniqueText("Retried");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await refuseSends(chat);
    await chat.composer.send(deleted);
    await chat.composer.send(retried);
    await expect(chat.timeline.retryIcon(retried)).toBeVisible();

    await test.step("the menu holds only what makes sense", async () => {
      const menu = await chat.timeline.openActions(deleted);
      await expect(
        menu.getByRole("button", { name: "Retry", exact: true }),
      ).toBeVisible();
      await expect(
        menu.getByRole("button", { name: "Reply", exact: true }),
      ).toHaveCount(0);
      await expect(
        menu.getByRole("button", { name: "Add a reaction" }),
      ).toHaveCount(0);
      await chat.page.keyboard.press("Escape");
    });

    await test.step("deleting it is for good", async () => {
      await chat.timeline.pickAction(deleted, "Delete");
      await chat.timeline.expectNoMessage(deleted);
      await chat.reload();
      await expect(chat.timeline.retryIcon(retried)).toBeVisible();
      await chat.timeline.expectNoMessage(deleted);
    });

    await test.step("retrying sends it", async () => {
      await acceptSends(chat);
      const menu = await chat.timeline.openActions(retried);
      await menu.getByRole("button", { name: "Retry", exact: true }).click();
      await bob.api.waitForText(roomId, retried);
      await expect(chat.timeline.retryIcon(retried)).toHaveCount(0);
    });
  });

  test("keeps a refused reply in its thread", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const root = uniqueText("Root");
    const reply = uniqueText("Reply");
    await alice.api.sendText(roomId, root);

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.timeline.reply(root);
    await chat.threads.expectThread(root);
    await refuseSends(chat);
    await chat.threads.composer.send(reply);
    await expect(chat.threads.timeline.retryIcon(reply)).toBeVisible();

    await test.step("closing and opening the thread finds it", async () => {
      await chat.threads.backToList();
      await chat.timeline.reply(root);
      await expect(chat.threads.timeline.retryIcon(reply)).toBeVisible();
      await chat.timeline.expectNoMessage(reply);
    });

    await test.step("its icon sends it again", async () => {
      await acceptSends(chat);
      await chat.threads.timeline.retryIcon(reply).click();
      await bob.api.waitForText(roomId, reply);
      await chat.threads.timeline.expectMessageOnce(reply);
      await expect(chat.threads.timeline.retryIcon(reply)).toHaveCount(0);
    });
  });

  test("keeps a refused file, which goes out when sent again", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const pdf = testPdf(`report-${uniqueId()}`);

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.composer.attach([pdf]);
    await refuseSends(chat);
    await chat.composer.sendAttachments();
    const message = chat.timeline.attachmentMessage(pdf.name, "file");
    await expect(chat.timeline.retryIcon(message)).toBeVisible();

    await chat.reload();
    await expect(chat.timeline.retryIcon(message)).toBeVisible();
    await acceptSends(chat);
    await chat.timeline.retryIcon(message).click();
    await bob.api.waitForEvent(
      roomId,
      (event) => event.content.filename === pdf.name,
    );
    await expect(chat.timeline.retryIcon(message)).toHaveCount(0);
  });

  test("erases refused messages when logging out", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    await createUnencryptedRoom(alice, [bob]);
    const refused = uniqueText("Refused");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await refuseSends(chat);
    await chat.composer.send(refused);
    await expect(chat.timeline.retryIcon(refused)).toBeVisible();

    const stored = () =>
      chat.page.evaluate(() =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith("hubFailedMessages:"),
        ),
      );
    expect(await stored()).toHaveLength(1);
    await chat.accountMenu.logout();
    expect(await stored()).toEqual([]);
  });

  test("leaves a queued reply in its thread when another one opens", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const rootA = uniqueText("Budget");
    const rootB = uniqueText("Recruitment");
    const rootAId = await alice.api.sendText(roomId, rootA);
    await alice.api.sendText(roomId, rootB);
    const first = uniqueText("Approved");
    const second = uniqueText("Ten percent less");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.timeline.reply(rootA);
    await chat.threads.expectThread(rootA);
    const held = await holdRequests(chat.page, SEND_REQUESTS);
    await chat.threads.composer.field.fill(first);
    await chat.threads.composer.field.press("Enter");
    await held.held;
    await chat.threads.composer.field.fill(second);
    await chat.threads.composer.field.press("Enter");

    await chat.timeline.reply(rootB);
    await chat.threads.expectThread(rootB);
    await held.release();

    const received = await bob.api.waitForText(roomId, second);
    expect(received.content["m.relates_to"]).toMatchObject({
      rel_type: "m.thread",
      event_id: rootAId,
    });
    await chat.threads.timeline.expectNoMessage(second);
  });

  test("leaves a queued reply in its conversation when another one opens", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomA = await createUnencryptedRoom(alice, [bob]);
    const roomB = await createUnencryptedRoom(alice, [carol]);
    const root = uniqueText("Root");
    const rootId = await alice.api.sendText(roomA, root);
    const first = uniqueText("First for Bob");
    const second = uniqueText("Second for Bob");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.timeline.reply(root);
    await chat.threads.expectThread(root);
    const held = await holdRequests(chat.page, SEND_REQUESTS);
    await chat.threads.composer.field.fill(first);
    await chat.threads.composer.field.press("Enter");
    await held.held;
    await chat.threads.composer.field.fill(second);
    await chat.threads.composer.field.press("Enter");

    await chat.openConversation(carol.displayName);
    await held.release();

    const received = await bob.api.waitForText(roomA, second);
    expect(received.content["m.relates_to"]).toMatchObject({
      event_id: rootId,
    });
    expect(bodiesOf(await carol.api.messages(roomB))).toEqual([]);
  });

  test("still sends a queued message after moving to another conversation", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomA = await createUnencryptedRoom(alice, [bob]);
    const roomB = await createUnencryptedRoom(alice, [carol]);
    const first = uniqueText("First for Bob");
    const second = uniqueText("Second for Bob");
    const forCarol = uniqueText("For Carol");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    const held = await holdRequests(chat.page, SEND_REQUESTS);
    await chat.composer.field.fill(first);
    await chat.composer.field.press("Enter");
    await held.held;
    await chat.composer.field.fill(second);
    await chat.composer.field.press("Enter");

    await chat.openConversation(carol.displayName);
    await chat.composer.field.fill(forCarol);
    await chat.composer.field.press("Enter");
    await held.release();

    await bob.api.waitForText(roomA, second);
    await carol.api.waitForText(roomB, forCarol);
    expect(bodiesOf(await bob.api.messages(roomA))).toEqual([second, first]);
    expect(bodiesOf(await carol.api.messages(roomB))).toEqual([forCarol]);
  });

  test("keeps sending while the tab is hidden", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const first = uniqueText("First");
    const second = uniqueText("Second");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    const held = await holdRequests(chat.page, SEND_REQUESTS);
    await chat.composer.field.fill(first);
    await chat.composer.field.press("Enter");
    await held.held;
    await chat.composer.field.fill(second);
    await chat.composer.field.press("Enter");

    await setTabHidden(chat, true);
    await held.release();
    await bob.api.waitForText(roomId, second);
    expect(bodiesOf(await bob.api.messages(roomId))).toEqual([second, first]);
  });

  test("gives back a message still being sent when the tab closes", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const inFlight = uniqueText("In flight");
    const queued = uniqueText("Queued");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.page.route(SEND_REQUESTS, () => new Promise(() => {}));
    await chat.composer.field.fill(inFlight);
    await chat.composer.field.press("Enter");
    await chat.composer.field.fill(queued);
    await chat.composer.field.press("Enter");
    await chat.timeline.expectMessageOnce(queued);

    const tab = await reopenTab(chat);
    await expect(tab.timeline.retryIcon(inFlight)).toBeVisible({
      timeout: SYNC_TIMEOUT,
    });
    await expect(tab.timeline.retryIcon(queued)).toBeVisible();

    await test.step("sent again, they arrive in the order chosen", async () => {
      await tab.timeline.retryIcon(inFlight).click();
      await bob.api.waitForText(roomId, inFlight);
      await tab.timeline.retryIcon(queued).click();
      await bob.api.waitForText(roomId, queued);
      expect(bodiesOf(await bob.api.messages(roomId))).toEqual([
        queued,
        inFlight,
      ]);
    });
  });

  test("does not list as failed a message the server got before the tab closed", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const text = uniqueText("Sent then closed");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    // The server records it, and the answer never reaches the page.
    await chat.page.route(SEND_REQUESTS, async (route) => {
      await route.fetch();
    });
    await chat.composer.field.fill(text);
    await chat.composer.field.press("Enter");
    await bob.api.waitForText(roomId, text);

    const tab = await reopenTab(chat);
    await tab.timeline.expectMessageOnce(text);
    await expect(tab.timeline.retryIcon(text)).toHaveCount(0);
    await expect
      .poll(() =>
        tab.page.evaluate(() =>
          Object.keys(localStorage).filter((key) =>
            key.startsWith("hubFailedMessages:"),
          ),
        ),
      )
      .toEqual([]);
  });

  test("never records twice a message whose answer was lost", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const text = uniqueText("Answer lost");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    // No /sync either: the page only learns of the event through the retry.
    const heldSync = await holdRequests(chat.page, SYNC_REQUESTS);
    await bob.api.sendText(roomId, uniqueText("Ends the running /sync"));
    await heldSync.held;
    await chat.page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await chat.page.route(
      SEND_REQUESTS,
      async (route) => {
        await route.fetch();
        await route.abort();
      },
      { times: 1 },
    );
    await chat.composer.field.fill(text);
    await chat.composer.field.press("Enter");
    await bob.api.waitForText(roomId, text);
    await expect(chat.timeline.retryIcon(text)).toBeVisible();

    await chat.timeline.retryIcon(text).click();
    await expect(chat.timeline.retryIcon(text)).toHaveCount(0);
    await heldSync.release();
    await chat.timeline.expectMessageOnce(text);
    await chat.reload();
    await chat.timeline.expectMessageOnce(text);
    const bodies = bodiesOf(await bob.api.messages(roomId));
    expect(bodies.filter((body) => body === text)).toHaveLength(1);
  });

  test("shows a message sent offline as failed, without waiting", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const text = uniqueText("Offline");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await chat.page.context().setOffline(true);
    await chat.composer.send(text);
    await expect(chat.timeline.retryIcon(text)).toBeVisible();

    await chat.page.context().setOffline(false);
    await chat.timeline.retryIcon(text).click();
    await bob.api.waitForText(roomId, text);
    await expect(chat.timeline.retryIcon(text)).toHaveCount(0);
  });

  test("counts only the replies that reached the server", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const root = uniqueText("Root");
    await alice.api.sendText(roomId, root);
    const first = uniqueText("First reply");
    const refused = uniqueText("Refused reply");
    const accepted = uniqueText("Accepted reply");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.timeline.reply(root);
    await chat.threads.expectThread(root);
    await chat.threads.composer.send(first);
    await expect(chat.timeline.threadButton(root)).toHaveText("1 reply");

    await chat.page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await chat.page.route(
      SEND_REQUESTS,
      (route) =>
        route.fulfill({
          status: 403,
          json: { errcode: "M_FORBIDDEN", error: "Refused" },
        }),
      { times: 1 },
    );
    await chat.threads.composer.send(refused);
    await chat.threads.composer.send(accepted);
    await bob.api.waitForText(roomId, accepted);
    await expect(chat.threads.timeline.retryIcon(refused)).toBeVisible();
    await expect(chat.timeline.threadButton(root)).toHaveText("2 replies");

    await chat.threads.timeline.retryIcon(refused).click();
    await bob.api.waitForText(roomId, refused);
    await expect(chat.timeline.threadButton(root)).toHaveText("3 replies");
  });

  test("opens a conversation whatever the storage holds", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const hello = uniqueText("Hello");
    await alice.api.sendText(roomId, hello);
    const valid = uniqueText("Valid");
    const draft = uniqueText("Draft");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await refuseSends(chat);
    await chat.composer.send(valid);
    await expect(chat.timeline.retryIcon(valid)).toBeVisible();
    await chat.composer.type(draft);

    const keyStartingWith = (prefix: string) =>
      chat.page.evaluate(
        (start) =>
          Object.keys(localStorage).find((key) => key.startsWith(start)) ?? "",
        prefix,
      );
    const failedKey = await keyStartingWith("hubFailedMessages:");
    const draftKey = await keyStartingWith("hubComposerDraft:");
    expect(failedKey).not.toBe("");
    expect(draftKey).not.toBe("");

    const store = (key: string, value: string) =>
      chat.page.evaluate(
        ([storageKey, stored]) => localStorage.setItem(storageKey, stored),
        [key, value],
      );
    const expectUsable = async () => {
      await chat.reload();
      await chat.timeline.expectMessage(hello);
      await expect(chat.composer.field).toBeVisible();
    };

    await test.step("a damaged entry among valid ones is only skipped", async () => {
      const list = await chat.page.evaluate(
        (key) => localStorage.getItem(key) ?? "[]",
        failedKey,
      );
      await store(
        failedKey,
        JSON.stringify([...JSON.parse(list), { id: "old-format" }, null]),
      );
      await expectUsable();
      await expect(chat.timeline.retryIcon(valid)).toBeVisible();
    });

    for (const damaged of ["{}", "null", "not json", '[{"message":{}}]']) {
      await test.step(`failed messages holding ${damaged}`, async () => {
        await store(failedKey, damaged);
        await expectUsable();
        await expect(chat.timeline.retryIcon(valid)).toHaveCount(0);
      });
    }

    for (const damaged of ['{"text":5,"mentions":[]}', "null", "not json"]) {
      await test.step(`a draft holding ${damaged}`, async () => {
        await store(draftKey, damaged);
        await expectUsable();
        await expect(chat.composer.field).toHaveValue("");
      });
    }
  });

  test("gives the focus to the composer after a retry or a delete", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    await createUnencryptedRoom(alice, [bob]);
    const retried = uniqueText("Retried");
    const deleted = uniqueText("Deleted");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await refuseSends(chat);
    await chat.composer.send(retried);
    await chat.composer.send(deleted);
    await expect(chat.timeline.retryIcon(deleted)).toBeVisible();
    await acceptSends(chat);

    await test.step("from the icon, with the keyboard", async () => {
      await chat.timeline.retryIcon(retried).focus();
      await chat.page.keyboard.press("Enter");
      await expect(chat.timeline.retryIcon(retried)).toHaveCount(0);
      await expect(chat.composer.field).toBeFocused();
    });

    await test.step("from the menu", async () => {
      await chat.timeline.pickAction(deleted, "Delete");
      await chat.timeline.expectNoMessage(deleted);
      await expect(chat.composer.field).toBeFocused();
    });
  });

  test("sends again a refused message in an encrypted conversation", async ({
    people,
    hub,
    devices,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const alicePhone = await devices.start(alice);
    const bobPhone = await devices.start(bob);
    const roomId = await createEncryptedRoom(bobPhone, [alice.api]);
    const inSession = uniqueText("Sent again at once");
    const afterReload = uniqueText("Sent again after a reload");
    const closedTab = uniqueText("Being sent when the tab closed");

    const chat = await hub.open(alice);
    await verifyHubDevice(chat, alicePhone);
    await chat.openConversation(bob.displayName);
    await refuseSends(chat);
    await chat.composer.send(inSession);
    await expect(chat.timeline.retryIcon(inSession)).toBeVisible();

    await test.step("in the same session, Bob's device decrypts it", async () => {
      await acceptSends(chat);
      await chat.timeline.retryIcon(inSession).click();
      const received = await bobPhone.waitForText(roomId, inSession);
      expect(received.getSender()).toBe(alice.userId);
      await expect(chat.timeline.retryIcon(inSession)).toHaveCount(0);
      await chat.timeline.expectMessageOnce(inSession);
    });

    await test.step("after a reload, Bob's device decrypts it", async () => {
      await refuseSends(chat);
      await chat.composer.send(afterReload);
      await expect(chat.timeline.retryIcon(afterReload)).toBeVisible();
      await chat.reload();
      await acceptSends(chat);
      await chat.composer.expectUsable();
      await expect(chat.timeline.retryIcon(afterReload)).toBeVisible();
      await chat.timeline.retryIcon(afterReload).click();
      await bobPhone.waitForText(roomId, afterReload);
      await expect(chat.timeline.retryIcon(afterReload)).toHaveCount(0);
      await chat.timeline.expectMessageOnce(afterReload);
    });

    await test.step("after closing the tab, Bob's device decrypts it", async () => {
      await chat.page.route(SEND_REQUESTS, () => new Promise(() => {}));
      await chat.composer.field.fill(closedTab);
      await chat.composer.field.press("Enter");
      await chat.timeline.expectMessageOnce(closedTab);
      const tab = await reopenTab(chat);
      await tab.composer.expectUsable();
      await expect(tab.timeline.retryIcon(closedTab)).toBeVisible({
        timeout: SYNC_TIMEOUT,
      });
      await tab.timeline.retryIcon(closedTab).click();
      await bobPhone.waitForText(roomId, closedTab);
      await expect(tab.timeline.retryIcon(closedTab)).toHaveCount(0);
    });
  });

  test("still reads what arrives under a failed message", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const refused = uniqueText("Refused");
    const fromBob = uniqueText("From Bob");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await refuseSends(chat);
    await chat.composer.send(refused);
    await expect(chat.timeline.retryIcon(refused)).toBeVisible();

    await bob.api.sendText(roomId, fromBob);
    await chat.timeline.expectMessage(fromBob);
    await expect(chat.timeline.messages().last()).toContainText(refused);
    await chat.readOpenConversation(bob.displayName);
  });
});
