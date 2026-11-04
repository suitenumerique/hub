import type { ChatPage } from "./utils/pages/chat-page";
import { expect, test, type Person } from "./utils/fixtures";
import { createUnencryptedRoom, verifyHubDevice } from "./utils/flows";
import { uniqueText } from "./utils/ids";
import { ALL_MESSAGES_ACTIONS, MENTIONS_ACTIONS } from "./utils/matrix-api";

const ALL = "All messages";
const MENTIONS = "Mentions & following";
const MUTE = "Mute";
const DEFAULT = "Default";

/** Every level as the menu lists it once the chat has a level of its own. */
const LEVELS = [ALL, MENTIONS, MUTE];

/** Time left to a notification that should not come before saying it did not. */
const SILENCE_MS = 1_500;

type Notifications = {
  /** Body of every notification shown so far, in order. */
  bodies: () => Promise<string[]>;
};

/**
 * Replaces `window.Notification` and makes the page report no focus, the case
 * where the Hub shows one: nothing comes from the browser's permission prompt.
 */
const watchNotifications = async (chat: ChatPage): Promise<Notifications> => {
  await chat.page.evaluate(() => {
    const shown: string[] = [];
    Object.assign(window, { shownNotifications: shown });
    class FakeNotification {
      static permission = "granted";
      static requestPermission = async () => "granted";
      onclose: unknown = null;
      onclick: unknown = null;
      constructor(_title: string, options?: { body?: string }) {
        shown.push(options?.body ?? "");
      }
      close() {}
    }
    Object.assign(window, { Notification: FakeNotification });
    document.hasFocus = () => false;
  });
  return {
    bodies: () =>
      chat.page.evaluate(
        () =>
          (window as unknown as { shownNotifications: string[] })
            .shownNotifications,
      ),
  };
};

/** Waits for these bodies, then checks that no other one comes after them. */
const expectNotified = async (
  chat: ChatPage,
  notifications: Notifications,
  bodies: string[],
): Promise<void> => {
  const sorted = [...bodies].sort();
  await expect
    .poll(async () => (await notifications.bodies()).sort())
    .toEqual(sorted);
  await chat.page.waitForTimeout(SILENCE_MS);
  expect((await notifications.bodies()).sort()).toEqual(sorted);
};

type Scene = {
  alice: Person;
  bob: Person;
  carol: Person;
  roomId: string;
  roomName: string;
  /** A direct chat with Carol, which notifies whatever happens elsewhere. */
  witnessId: string;
};

/** Bob in a group of three, where a thread is not followed by default. */
const createScene = async (people: {
  create: (name: string) => Promise<Person>;
}): Promise<Scene> => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const carol = await people.create("Carol");
  const roomName = uniqueText("Group");
  const roomId = await createUnencryptedRoom(alice, [bob, carol], {
    name: roomName,
  });
  const witnessId = await createUnencryptedRoom(carol, [bob]);
  return { alice, bob, carol, roomId, roomName, witnessId };
};

test.describe("Notification levels", () => {
  test("chooses a level, stored as Tchap stores it", async ({
    people,
    hub,
  }) => {
    const { bob, roomId, roomName } = await createScene(people);
    const chat = await hub.open(bob);
    await chat.leftPanel.expectConversation(roomName);

    await test.step("a chat from elsewhere shows Default, on top", async () => {
      const menu = await chat.leftPanel.openMoreMenu(roomName);
      await expect(
        menu.getByRole("menuitem", { name: "Notifications" }),
      ).toBeEnabled();
      await chat.notifications.openLevels(menu);
      await chat.notifications.expectLevels([DEFAULT, ...LEVELS], DEFAULT);
      await chat.notifications.close();
      expect(await bob.api.pushRule("room", roomId)).toBeNull();
      expect(await bob.api.pushRule("override", roomId)).toBeNull();
    });

    await test.step("Mentions & following writes a dont_notify room rule", async () => {
      const menu = await chat.leftPanel.openMoreMenu(roomName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.choose(MENTIONS);
      await expect
        .poll(async () => (await bob.api.pushRule("room", roomId))?.actions)
        .toEqual(MENTIONS_ACTIONS);
    });

    await test.step("Default is gone", async () => {
      const menu = await chat.leftPanel.openMoreMenu(roomName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.expectLevels(LEVELS, MENTIONS);
      await chat.notifications.close();
    });

    await test.step("choosing the current level writes nothing", async () => {
      const writes: string[] = [];
      const onRequest = (request: {
        url: () => string;
        method: () => string;
      }) => {
        if (/\/pushrules\//.test(request.url()) && request.method() !== "GET") {
          writes.push(request.url());
        }
      };
      chat.page.on("request", onRequest);
      const menu = await chat.leftPanel.openMoreMenu(roomName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.choose(MENTIONS);
      await chat.page.waitForTimeout(500);
      chat.page.off("request", onRequest);
      expect(writes).toEqual([]);
    });

    await test.step("All messages writes notify with the default sound", async () => {
      const menu = await chat.leftPanel.openMoreMenu(roomName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.choose(ALL);
      await expect
        .poll(async () => (await bob.api.pushRule("room", roomId))?.actions)
        .toEqual(ALL_MESSAGES_ACTIONS);
    });

    await test.step("the header menu sets Mute: override rule, no room rule", async () => {
      await chat.openConversation(roomName);
      const menu = await chat.header.openMenu(roomName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.expectLevels(LEVELS, ALL);
      await chat.notifications.choose(MUTE);
      await expect
        .poll(() => bob.api.pushRule("override", roomId))
        .toMatchObject({
          rule_id: roomId,
          enabled: true,
          actions: ["dont_notify"],
          conditions: [
            { kind: "event_match", key: "room_id", pattern: roomId },
          ],
        });
      await expect.poll(() => bob.api.pushRule("room", roomId)).toBeNull();
    });

    await test.step("leaving Mute removes the override rule", async () => {
      const menu = await chat.header.openMenu(roomName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.expectLevels(LEVELS, MUTE);
      await chat.notifications.choose(MENTIONS);
      await expect.poll(() => bob.api.pushRule("override", roomId)).toBeNull();
      await expect
        .poll(async () => (await bob.api.pushRule("room", roomId))?.actions)
        .toEqual(MENTIONS_ACTIONS);
    });

    await test.step("the level survives a reload", async () => {
      await chat.reload();
      const menu = await chat.header.openMenu(roomName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.expectLevels(LEVELS, MENTIONS);
      await chat.notifications.close();
    });

    await test.step("a failed write takes the level back and says so", async () => {
      await chat.page.route(/\/pushrules\/global\//, (route) =>
        route.request().method() === "GET"
          ? route.continue()
          : route.fulfill({
              status: 500,
              json: { errcode: "M_UNKNOWN", error: "refused" },
            }),
      );
      const menu = await chat.header.openMenu(roomName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.choose(MUTE);
      await expect(
        chat.page.getByText(
          "The notification level could not be changed. Please try again.",
        ),
      ).toBeVisible();
      await chat.page.unroute(/\/pushrules\/global\//);
      const again = await chat.header.openMenu(roomName);
      await chat.notifications.openLevels(again);
      await chat.notifications.expectLevels(LEVELS, MENTIONS);
      await chat.notifications.close();
    });
  });

  test("offers every choice in French too", async ({ people, hub }) => {
    const { bob, roomName } = await createScene(people);
    const chat = await hub.open(bob);
    await chat.openConversation(roomName);
    await chat.accountMenu.chooseLanguage("Français");

    const menu = await chat.header.openMenu(roomName);
    await chat.notifications.openLevels(menu);
    await chat.notifications.expectLevels(
      ["Par défaut", "Tous les messages", "Mentions & suivis", "Ignorer"],
      "Par défaut",
    );
    await chat.notifications.choose("Ignorer");

    const again = await chat.header.openMenu(roomName);
    await chat.notifications.openLevels(again);
    await chat.notifications.expectLevels(
      ["Tous les messages", "Mentions & suivis", "Ignorer"],
      "Ignorer",
    );
    await chat.notifications.close();
  });

  test("reflects what Tchap changes", async ({ people, hub }) => {
    const { bob, roomId, roomName } = await createScene(people);
    const chat = await hub.open(bob);
    await chat.openConversation(roomName);

    const expectFromHeader = async (labels: string[], current: string) => {
      await expect(async () => {
        const menu = await chat.header.openMenu(roomName);
        try {
          await chat.notifications.openLevels(menu);
          await chat.notifications.expectLevels(labels, current);
        } finally {
          await chat.notifications.close();
        }
      }).toPass({ timeout: 20_000 });
    };

    await test.step("a room rule set elsewhere", async () => {
      await bob.api.setRoomRule(roomId, MENTIONS_ACTIONS);
      await expectFromHeader(LEVELS, MENTIONS);
    });

    await test.step("a mute rule set elsewhere", async () => {
      await bob.api.setMuteRule(roomId);
      await expectFromHeader(LEVELS, MUTE);
    });

    await test.step("a notify rule without sound counts as All messages", async () => {
      await bob.api.setRoomRule(roomId, ["notify"]);
      await expectFromHeader(LEVELS, ALL);
    });

    await test.step("a disabled rule counts as absent", async () => {
      await bob.api.setPushRuleEnabled("room", roomId, false);
      await expectFromHeader([DEFAULT, ...LEVELS], DEFAULT);
      await bob.api.setPushRuleEnabled("room", roomId, true);
      await expectFromHeader(LEVELS, ALL);
    });

    await test.step("back to Default from elsewhere, the row returns", async () => {
      await bob.api.deleteRoomRule(roomId);
      await expectFromHeader([DEFAULT, ...LEVELS], DEFAULT);
    });
  });

  test("a muted chat stays read, at the bottom, sorted among muted ones", async ({
    people,
    hub,
  }) => {
    const { alice, bob, carol, roomId, roomName, witnessId } =
      await createScene(people);
    const otherName = uniqueText("Muted too");
    const otherId = await createUnencryptedRoom(alice, [bob], {
      name: otherName,
    });
    const root = await bob.api.sendText(roomId, uniqueText("Bob's root"));
    const firstUnread = uniqueText("First unread");
    await carol.api.sendText(witnessId, uniqueText("Witness"));
    const chat = await hub.open(bob);
    await chat.openConversation(carol.displayName);
    await chat.leftPanel.expectConversation(roomName);

    await test.step("muting removes the unread dot of the chat and threads", async () => {
      await carol.api.sendText(roomId, uniqueText("Reply"), {
        threadRootId: root,
      });
      await alice.api.sendText(roomId, firstUnread);
      await chat.leftPanel.expectUnread(roomName);
      await chat.openConversation(roomName);
      await chat.threads.expectUnreadThreadsBanner(/unread thread/);
      await chat.openConversation(carol.displayName);

      await carol.api.sendText(roomId, uniqueText("Another reply"), {
        threadRootId: root,
      });
      await chat.leftPanel.expectUnread(roomName);
      const menu = await chat.leftPanel.openMoreMenu(roomName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.choose(MUTE);
      await chat.leftPanel.expectRead(roomName);
    });

    await test.step("it goes below the other chats, without any title", async () => {
      await carol.api.sendText(witnessId, uniqueText("Latest"));
      await expect(
        chat.leftPanel.rows().last().getByRole("link"),
      ).toHaveAccessibleName(roomName);
    });

    const stillMuted = uniqueText("Still muted");

    await test.step("new messages neither mark it unread nor move it up", async () => {
      await alice.api.sendText(roomId, stillMuted);
      await carol.api.sendText(roomId, uniqueText("Reply still muted"), {
        threadRootId: root,
      });
      await chat.page.waitForTimeout(SILENCE_MS);
      await chat.leftPanel.expectRead(roomName);
      await expect(
        chat.leftPanel.rows().last().getByRole("link"),
      ).toHaveAccessibleName(roomName);
    });

    await test.step("muted chats sort by activity among themselves", async () => {
      await bob.api.setMuteRule(otherId);
      await alice.api.sendText(otherId, uniqueText("Other muted activity"));
      await expect(
        chat.leftPanel.rows().last().getByRole("link"),
      ).toHaveAccessibleName(roomName);
      await alice.api.sendText(roomId, uniqueText("Passes the other one"));
      await expect(
        chat.leftPanel.rows().last().getByRole("link"),
      ).toHaveAccessibleName(otherName);
      await chat.leftPanel.expectRead(otherName);
    });

    await test.step("Mark as unread still works, even after a reload", async () => {
      const menu = await chat.leftPanel.openMoreMenu(roomName);
      await menu.getByRole("menuitem", { name: "Mark as unread" }).click();
      await chat.leftPanel.expectUnread(roomName);
      await chat.reload();
      await chat.leftPanel.expectUnread(roomName);
      await chat.leftPanel.expectRead(otherName);
    });

    await test.step("it opens on its first unread, without the threads banner", async () => {
      await chat.openConversation(roomName);
      await chat.timeline.expectUnreadSeparatorBefore(stillMuted);
      await expect(chat.threads.unreadBanner).toBeHidden();
      await chat.leftPanel.expectRead(roomName);
    });
  });

  test("a reaction moves nothing, added or removed", async ({
    people,
    hub,
  }) => {
    const { alice, bob, carol, roomId, roomName, witnessId } =
      await createScene(people);
    const text = uniqueText("To react to");
    const target = await alice.api.sendText(roomId, text);
    await bob.api.markRead(roomId, target, "main");
    await bob.api.setRoomRule(roomId, ALL_MESSAGES_ACTIONS);
    const latest = uniqueText("Latest");
    await carol.api.sendText(witnessId, latest);

    const chat = await hub.open(bob);
    await chat.openConversation(carol.displayName);
    await chat.leftPanel.expectFirst(carol.displayName);
    const notifications = await watchNotifications(chat);

    const reaction = await test.step("added", async () => {
      const eventId = await alice.api.react(roomId, target, "👍");
      await chat.page.waitForTimeout(SILENCE_MS);
      await chat.leftPanel.expectFirst(carol.displayName);
      return eventId;
    });

    await test.step("removed", async () => {
      await alice.api.redact(roomId, reaction);
      await chat.page.waitForTimeout(SILENCE_MS);
      await chat.leftPanel.expectFirst(carol.displayName);
      expect(await notifications.bodies()).toEqual([]);
      // A reload reads the list again, which nothing else asked for.
      await chat.reload();
      await chat.leftPanel.expectFirst(carol.displayName);
    });

    await test.step("deleting a message moves nothing either", async () => {
      await alice.api.redact(roomId, target);
      await chat.page.waitForTimeout(SILENCE_MS);
      await chat.leftPanel.expectFirst(carol.displayName);
      await chat.reload();
      await chat.leftPanel.expectFirst(carol.displayName);
    });
  });

  for (const { label, actions, messageNotifies } of [
    {
      label: ALL,
      actions: ALL_MESSAGES_ACTIONS,
      messageNotifies: true,
    },
    {
      label: MENTIONS,
      actions: MENTIONS_ACTIONS,
      messageNotifies: false,
    },
  ]) {
    test(`notifies at ${label}`, async ({ people, hub }) => {
      const { alice, bob, carol, roomId, witnessId } =
        await createScene(people);
      await bob.api.setRoomRule(roomId, actions);
      const ownRoot = await bob.api.sendText(roomId, uniqueText("Bob's root"));
      const repliedRoot = await alice.api.sendText(
        roomId,
        uniqueText("Bob replied here"),
      );
      await bob.api.sendText(roomId, uniqueText("Bob's reply"), {
        threadRootId: repliedRoot,
      });
      const otherRoot = await alice.api.sendText(
        roomId,
        uniqueText("Not Bob's thread"),
      );
      await carol.api.sendText(roomId, uniqueText("First reply"), {
        threadRootId: otherRoot,
      });

      const chat = await hub.open(bob);
      await chat.openConversation(carol.displayName);
      const notifications = await watchNotifications(chat);
      const expected: string[] = [];

      const message = uniqueText("Plain message");
      await alice.api.sendText(roomId, message);
      if (messageNotifies) expected.push(message);

      const mention = uniqueText("Mention");
      await alice.api.sendText(roomId, mention, { mentions: [bob.userId] });
      expected.push(mention);

      const ownThreadReply = uniqueText("In Bob's thread");
      await alice.api.sendText(roomId, ownThreadReply, {
        threadRootId: ownRoot,
      });
      expected.push(ownThreadReply);

      const repliedThreadReply = uniqueText("In a thread Bob replied to");
      await carol.api.sendText(roomId, repliedThreadReply, {
        threadRootId: repliedRoot,
      });
      expected.push(repliedThreadReply);

      await carol.api.sendText(roomId, uniqueText("In another thread"), {
        threadRootId: otherRoot,
      });

      const threadMention = uniqueText("Mention in another thread");
      await carol.api.sendText(roomId, threadMention, {
        threadRootId: otherRoot,
        mentions: [bob.userId],
      });
      expected.push(threadMention);

      const witness = uniqueText("Witness");
      await carol.api.sendText(witnessId, witness);
      expected.push(witness);

      await expectNotified(chat, notifications, expected);
    });
  }

  test("a followed thread the client just discovers still notifies", async ({
    people,
    hub,
  }) => {
    const { alice, bob, carol, roomId, witnessId } = await createScene(people);
    await bob.api.setRoomRule(roomId, MENTIONS_ACTIONS);
    const ownRoot = await bob.api.sendText(roomId, uniqueText("Old root"));
    const otherRoot = await alice.api.sendText(
      roomId,
      uniqueText("Old root of another thread"),
    );
    // Their roots are out of what the Hub syncs at start.
    await alice.api.sendMany(roomId, uniqueText("Filler"), 40);

    const chat = await hub.open(bob);
    await chat.openConversation(carol.displayName);
    const notifications = await watchNotifications(chat);

    const followed = uniqueText("Followed");
    await alice.api.sendText(roomId, followed, { threadRootId: ownRoot });
    await carol.api.sendText(roomId, uniqueText("Not followed"), {
      threadRootId: otherRoot,
    });
    const witness = uniqueText("Witness");
    await carol.api.sendText(witnessId, witness);

    await expectNotified(chat, notifications, [followed, witness]);
  });

  test("in a two-person chat, every thread counts", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    await bob.api.setRoomRule(roomId, MENTIONS_ACTIONS);
    const root = await alice.api.sendText(roomId, uniqueText("Alice's root"));

    const carol = await people.create("Carol");
    await createUnencryptedRoom(carol, [bob]);
    const chat = await hub.open(bob);
    await chat.openConversation(carol.displayName);
    await chat.leftPanel.expectConversation(alice.displayName);
    const notifications = await watchNotifications(chat);

    const reply = uniqueText("Alice's reply");
    await alice.api.sendText(roomId, reply, { threadRootId: root });
    await expectNotified(chat, notifications, [reply]);
  });

  test("a muted chat never notifies, mentions included", async ({
    people,
    hub,
  }) => {
    const { alice, bob, carol, roomId, witnessId } = await createScene(people);
    await bob.api.setMuteRule(roomId);
    const root = await bob.api.sendText(roomId, uniqueText("Bob's root"));

    const chat = await hub.open(bob);
    await chat.openConversation(carol.displayName);
    const notifications = await watchNotifications(chat);

    await alice.api.sendText(roomId, uniqueText("Plain"));
    await alice.api.sendText(roomId, uniqueText("Mention"), {
      mentions: [bob.userId],
    });
    await alice.api.sendText(roomId, uniqueText("In Bob's thread"), {
      threadRootId: root,
    });
    await alice.api.sendText(roomId, uniqueText("Mention in Bob's thread"), {
      threadRootId: root,
      mentions: [bob.userId],
    });
    const witness = uniqueText("Witness");
    await carol.api.sendText(witnessId, witness);

    await expectNotified(chat, notifications, [witness]);
  });

  test("notifications turned off in Tchap only stop the notifications", async ({
    people,
    hub,
  }) => {
    const { alice, bob, carol, roomId, roomName, witnessId } =
      await createScene(people);
    await bob.api.setRoomRule(roomId, ALL_MESSAGES_ACTIONS);
    const root = await bob.api.sendText(roomId, uniqueText("Bob's root"));
    await carol.api.sendText(witnessId, uniqueText("First"));

    const chat = await hub.open(bob);
    await chat.openConversation(carol.displayName);
    const notifications = await watchNotifications(chat);
    await bob.api.setPushRuleEnabled("override", ".m.rule.master", true);
    // The rules reach the Hub with the next sync.
    await chat.page.waitForTimeout(SILENCE_MS);

    const message = uniqueText("Plain");
    await alice.api.sendText(roomId, message);
    await alice.api.sendText(roomId, uniqueText("In Bob's thread"), {
      threadRootId: root,
    });
    await alice.api.sendText(roomId, uniqueText("Mention"), {
      mentions: [bob.userId],
    });

    await chat.leftPanel.expectFirst(roomName);
    await chat.leftPanel.expectUnread(roomName);
    await chat.page.waitForTimeout(SILENCE_MS);
    expect(await notifications.bodies()).toEqual([]);
  });

  for (const { label, actions } of [
    { label: ALL, actions: ALL_MESSAGES_ACTIONS },
    { label: MENTIONS, actions: MENTIONS_ACTIONS },
  ]) {
    test(`a reply in another thread moves the chat up, unread until opened, at ${label}`, async ({
      people,
      hub,
    }) => {
      const { alice, bob, carol, roomId, roomName, witnessId } =
        await createScene(people);
      await bob.api.setRoomRule(roomId, actions);
      const root = await alice.api.sendText(
        roomId,
        uniqueText("Not Bob's thread"),
      );
      await bob.api.markRead(roomId, root, "main");
      await carol.api.sendText(witnessId, uniqueText("Latest"));

      const chat = await hub.open(bob);
      await chat.openConversation(carol.displayName);
      await chat.leftPanel.expectFirst(carol.displayName);
      await chat.leftPanel.expectRead(roomName);
      const notifications = await watchNotifications(chat);

      const reply = uniqueText("A reply Bob does not follow");
      await carol.api.sendText(roomId, reply, { threadRootId: root });

      await chat.leftPanel.expectFirst(roomName);
      await chat.leftPanel.expectUnread(roomName);
      expect(await notifications.bodies()).toEqual([]);

      await test.step("it stays so after a reload", async () => {
        await chat.reload();
        await chat.leftPanel.expectFirst(roomName);
        await chat.leftPanel.expectUnread(roomName);
      });

      await test.step("opening the chat removes the dot, for good", async () => {
        await chat.openConversation(roomName);
        await chat.leftPanel.expectRead(roomName);
        await chat.openConversation(carol.displayName);
        await chat.leftPanel.expectRead(roomName);
        await chat.reload();
        await chat.leftPanel.expectRead(roomName);
      });

      await test.step("a new reply brings it back", async () => {
        await carol.api.sendText(roomId, uniqueText("Another reply"), {
          threadRootId: root,
        });
        await chat.leftPanel.expectUnread(roomName);
      });
    });
  }

  test("a reaction in a thread does not make Bob follow it", async ({
    people,
    hub,
  }) => {
    const { alice, bob, carol, roomId, witnessId } = await createScene(people);
    await bob.api.setRoomRule(roomId, ALL_MESSAGES_ACTIONS);
    const root = await alice.api.sendText(roomId, uniqueText("Alice's root"));
    const firstReply = await carol.api.sendText(roomId, uniqueText("Reply"), {
      threadRootId: root,
    });

    const chat = await hub.open(bob);
    await chat.openConversation(carol.displayName);
    const notifications = await watchNotifications(chat);

    await bob.api.react(roomId, firstReply, "👍");
    await chat.page.waitForTimeout(SILENCE_MS);
    await carol.api.sendText(roomId, uniqueText("After the reaction"), {
      threadRootId: root,
    });
    const witness = uniqueText("Witness");
    await carol.api.sendText(witnessId, witness);

    await expectNotified(chat, notifications, [witness]);
  });

  test("a chat created in the Hub starts at All messages", async ({
    people,
    hub,
    devices,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const chat = await hub.open(alice);
    await verifyHubDevice(chat, await devices.start(alice));

    await test.step("a direct chat", async () => {
      await chat.leftPanel.openNewChat();
      await chat.newChat.add(bob);
      await chat.composer.send(uniqueText("Hello Bob"));
      const roomId = await chat.expectConversationUrl();
      await expect
        .poll(async () => (await alice.api.pushRule("room", roomId))?.actions)
        .toEqual(ALL_MESSAGES_ACTIONS);
      const menu = await chat.header.openMenu(bob.displayName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.expectLevels(LEVELS, ALL);
      await chat.notifications.close();
    });

    await test.step("a group", async () => {
      await chat.leftPanel.openNewChat();
      await chat.newChat.add(bob);
      await chat.newChat.add(carol);
      await chat.composer.send(uniqueText("Hello both"));
      await expect(chat.page).toHaveURL(/chat=/);
      const roomId = await chat.expectConversationUrl();
      await expect
        .poll(async () => (await alice.api.pushRule("room", roomId))?.actions)
        .toEqual(ALL_MESSAGES_ACTIONS);
    });
  });

  test("an accepted invitation starts at All messages, a chat from Tchap stays on Default", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const groupName = uniqueText("Invited group");
    const chat = await hub.open(bob);

    const fromTchap = await createUnencryptedRoom(carol, [bob]);
    await chat.leftPanel.expectConversation(carol.displayName);

    await test.step("an invitation has no level until accepted", async () => {
      const directId = await alice.api.createRoom({
        invite: [bob.userId],
        isDirect: true,
      });
      await chat.openConversation(alice.displayName);
      await chat.invitation.expectFrom(alice.displayName);
      expect(await bob.api.pushRule("room", directId)).toBeNull();
      await chat.invitation.accept();
      await expect
        .poll(async () => (await bob.api.pushRule("room", directId))?.actions)
        .toEqual(ALL_MESSAGES_ACTIONS);
      const menu = await chat.header.openMenu(alice.displayName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.expectLevels(LEVELS, ALL);
      await chat.notifications.close();
    });

    await test.step("an invitation to a group", async () => {
      const groupId = await alice.api.createRoom({
        name: groupName,
        invite: [bob.userId],
      });
      await chat.openConversation(groupName);
      await chat.invitation.accept();
      await expect
        .poll(async () => (await bob.api.pushRule("room", groupId))?.actions)
        .toEqual(ALL_MESSAGES_ACTIONS);
    });

    await test.step("the chat joined elsewhere has no rule", async () => {
      expect(await bob.api.pushRule("room", fromTchap)).toBeNull();
      await chat.openConversation(carol.displayName);
      const menu = await chat.header.openMenu(carol.displayName);
      await chat.notifications.openLevels(menu);
      await chat.notifications.expectLevels([DEFAULT, ...LEVELS], DEFAULT);
      await chat.notifications.close();
    });
  });

  test("a failed rule does not block a new chat, which stays on Default", async ({
    people,
    hub,
    devices,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const chat = await hub.open(alice);
    await verifyHubDevice(chat, await devices.start(alice));
    await chat.page.route(/\/pushrules\/global\//, (route) =>
      route.request().method() === "GET"
        ? route.continue()
        : route.fulfill({
            status: 500,
            json: { errcode: "M_UNKNOWN", error: "refused" },
          }),
    );

    await chat.leftPanel.openNewChat();
    await chat.newChat.add(bob);
    const text = uniqueText("Hello Bob");
    await chat.composer.send(text);
    const roomId = await chat.expectConversationUrl();
    await chat.timeline.expectMessageOnce(text);
    expect(await alice.api.pushRule("room", roomId)).toBeNull();

    const menu = await chat.header.openMenu(bob.displayName);
    await chat.notifications.openLevels(menu);
    await chat.notifications.expectLevels([DEFAULT, ...LEVELS], DEFAULT);
    await chat.notifications.close();
  });
});
