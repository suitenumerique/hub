import { SYNC_TIMEOUT } from "./utils/env";
import { expect, test } from "./utils/fixtures";
import {
  createEncryptedRoom,
  createUnencryptedRoom,
  markRoomRead,
} from "./utils/flows";
import { uniqueText } from "./utils/ids";
import { DELETED_MESSAGE, QUICK_REACTIONS } from "./utils/pages/timeline";

/** E2E-07: edits, deletions and reactions seen on both sides. */
test.describe("Message actions across two browsers", () => {
  test("shows an edit and a deletion to the other person", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    await createUnencryptedRoom(carol, [bob]);
    await markRoomRead(bob, roomId);
    const aliceChat = await hub.open(alice);
    const bobChat = await hub.open(bob);
    await aliceChat.openConversation(bob.displayName);
    await bobChat.openConversation(alice.displayName);

    const original = uniqueText("Original");
    const toDelete = uniqueText("To delete");
    await aliceChat.composer.send(original);
    await aliceChat.composer.send(toDelete);
    await bobChat.timeline.expectMessage(toDelete);

    await test.step("Alice edits, Bob sees the new text", async () => {
      const edited = uniqueText("Edited");
      await aliceChat.timeline.pickAction(original, "Edit");
      await expect(aliceChat.composer.editingStatus).toBeVisible();
      await expect(aliceChat.composer.field).toHaveValue(original);
      await aliceChat.composer.field.fill(edited);
      await aliceChat.composer.field.press("Enter");
      await expect(aliceChat.composer.editingStatus).toBeHidden();
      await bobChat.timeline.expectEdited(edited);
      await bobChat.timeline.expectNoMessage(original);
    });

    await test.step("Alice deletes, Bob sees it deleted and not unread", async () => {
      await bobChat.readOpenConversation(alice.displayName);
      await bobChat.openConversation(carol.displayName);
      await aliceChat.timeline.pickAction(toDelete, "Delete");
      await expect(aliceChat.timeline.deletedMessages()).toHaveCount(1);
      await bobChat.openConversation(alice.displayName);
      await expect(bobChat.timeline.deletedMessages()).toHaveCount(1);
      await bobChat.timeline.expectNoMessage(toDelete);
      await bobChat.openConversation(carol.displayName);
      await bobChat.leftPanel.expectRead(alice.displayName);
    });
  });

  test("keeps reaction counts consistent on both sides", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const text = uniqueText("React to me");
    await alice.api.sendText(roomId, text);
    const aliceChat = await hub.open(alice);
    const bobChat = await hub.open(bob);
    await aliceChat.openConversation(bob.displayName);
    await bobChat.openConversation(alice.displayName);

    await test.step("both react with the same emoji", async () => {
      await bobChat.timeline.react(text, "👍");
      await aliceChat.timeline.expectReaction(text, "👍", {
        count: 1,
        mine: false,
      });
      await aliceChat.timeline.react(text, "👍");
      await aliceChat.timeline.expectReaction(text, "👍", {
        count: 2,
        mine: true,
      });
      await bobChat.timeline.expectReaction(text, "👍", {
        count: 2,
        mine: true,
      });
    });

    await test.step("a second emoji only counts its own reactions", async () => {
      await aliceChat.timeline.react(text, "✅");
      await bobChat.timeline.expectReaction(text, "✅", {
        count: 1,
        mine: false,
      });
    });

    await test.step("removing a reaction updates the other side", async () => {
      await bobChat.timeline.reaction(text, "👍").click();
      await bobChat.timeline.expectReaction(text, "👍", {
        count: 1,
        mine: false,
      });
      await aliceChat.timeline.expectReaction(text, "👍", {
        count: 1,
        mine: true,
      });
    });

    await test.step("the counts are the same after a reload", async () => {
      await aliceChat.reload();
      await aliceChat.openConversation(bob.displayName);
      await aliceChat.timeline.expectReaction(text, "👍", {
        count: 1,
        mine: true,
      });
      await aliceChat.timeline.expectReaction(text, "✅", {
        count: 1,
        mine: true,
      });
      await bobChat.reload();
      await bobChat.openConversation(alice.displayName);
      await bobChat.timeline.expectReaction(text, "👍", {
        count: 1,
        mine: false,
      });
    });
  });
});

/** The "more" button beside a bubble opens the menu of the right click. */
test.describe("Message actions button", () => {
  test("shows beside the bubble and opens its actions menu", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const received = uniqueText("From Alice");
    const sent = uniqueText("From Bob");
    await alice.api.sendText(roomId, received);
    const sentId = await bob.api.sendText(roomId, sent);
    const bobChat = await hub.open(bob);
    await bobChat.openConversation(alice.displayName);
    await bobChat.timeline.expectMessage(sent);
    const { timeline, page } = bobChat;

    await test.step("hovering shows it outside the bubble, which stays put", async () => {
      // Received messages have it on the right, Bob's own on the left.
      for (const [text, side] of [
        [received, "right"],
        [sent, "left"],
      ] as const) {
        const body = timeline.body(text);
        const button = timeline.moreButton(text);
        await page.mouse.move(0, 0);
        await expect(button).toHaveCSS("opacity", "0");
        const before = (await body.boundingBox())!;
        await body.hover();
        await expect(button).toHaveCSS("opacity", "1");
        expect(await body.boundingBox()).toEqual(before);
        const box = (await button.boundingBox())!;
        const isRight = box.x >= before.x + before.width;
        const isLeft = box.x + box.width <= before.x;
        expect(isRight ? "right" : isLeft ? "left" : "over").toBe(side);
      }
    });

    await test.step("its menu stays open until it is pressed again", async () => {
      await timeline.openActionsFromButton(received);
      const button = timeline.moreButton(received);
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await page.mouse.move(0, 0);
      await expect(button).toHaveCSS("opacity", "1");
      await button.click();
      await expect(timeline.body(received)).not.toHaveAttribute(
        "data-toolbar-open",
      );
      await expect(button).toHaveAttribute("aria-expanded", "false");
    });

    await test.step("its menu acts on the message", async () => {
      const menu = await timeline.openActionsFromButton(received);
      await menu.getByRole("button", { name: QUICK_REACTIONS["👍"] }).click();
      await timeline.expectReaction(received, "👍", { count: 1, mine: true });
    });

    await test.step("a deleted message has none", async () => {
      await bob.api.redact(roomId, sentId);
      await expect(timeline.deletedMessages()).toHaveCount(1, {
        timeout: SYNC_TIMEOUT,
      });
      const deleted = timeline.messages().filter({ hasText: DELETED_MESSAGE });
      await expect(timeline.moreButton(deleted)).toHaveCount(0);
    });
  });

  test("opens from the keyboard and gives the focus back", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const text = uniqueText("Keyboard");
    await alice.api.sendText(roomId, text);
    const bobChat = await hub.open(bob);
    await bobChat.openConversation(alice.displayName);
    await bobChat.timeline.expectMessage(text);
    const { timeline, page } = bobChat;
    const button = timeline.moreButton(text);

    await button.focus();
    await page.keyboard.press("Enter");
    await expect(timeline.body(text)).toHaveAttribute(
      "data-toolbar-open",
      "true",
    );
    await expect(
      timeline.body(text).getByRole("button", { name: QUICK_REACTIONS["👍"] }),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(timeline.body(text)).not.toHaveAttribute("data-toolbar-open");
    await expect(button).toBeFocused();
    // Focused from the keyboard, it shows without the pointer on the message.
    await expect(button).toHaveCSS("opacity", "1");
  });
});

/** Reactions stay put: in place, in order, and sent whatever the encryption. */
test.describe("Reactions", () => {
  test("keeps the reaction order when counts change", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob, carol]);
    const text = uniqueText("React in order");
    const eventId = await alice.api.sendText(roomId, text);
    await alice.api.react(roomId, eventId, "👍");
    await alice.api.react(roomId, eventId, "✅");
    const bobChat = await hub.open(bob);
    await bobChat.openConversation({ roomId });
    await bobChat.timeline.expectReactionOrder(text, ["👍", "✅"]);

    await test.step("someone else adds to the second one", async () => {
      await carol.api.react(roomId, eventId, "✅");
      await bobChat.timeline.expectReaction(text, "✅", {
        count: 2,
        mine: false,
      });
      await bobChat.timeline.expectReactionOrder(text, ["👍", "✅"]);
    });

    await test.step("Bob adds to it, then removes it", async () => {
      await bobChat.timeline.react(text, "✅");
      await bobChat.timeline.expectReaction(text, "✅", {
        count: 3,
        mine: true,
      });
      await bobChat.timeline.expectReactionOrder(text, ["👍", "✅"]);
      await bobChat.timeline.reaction(text, "✅").click();
      await bobChat.timeline.expectReaction(text, "✅", {
        count: 2,
        mine: false,
      });
      await bobChat.timeline.expectReactionOrder(text, ["👍", "✅"]);
    });

    await test.step("the first one loses its first reaction", async () => {
      const firstThumb = (await alice.api.messages(roomId)).find(
        (event) =>
          event.type === "m.reaction" &&
          event.sender === alice.userId &&
          (event.content["m.relates_to"] as { key?: string }).key === "👍",
      )!;
      await carol.api.react(roomId, eventId, "👍");
      await bobChat.timeline.expectReaction(text, "👍", {
        count: 2,
        mine: false,
      });
      await alice.api.redact(roomId, firstThumb.event_id);
      await bobChat.timeline.expectReaction(text, "👍", {
        count: 1,
        mine: false,
      });
      await bobChat.timeline.expectReactionOrder(text, ["👍", "✅"]);
    });
  });

  test("reacts in an encrypted conversation before the Hub is verified", async ({
    people,
    hub,
    devices,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const alicePhone = await devices.start(alice);
    const roomId = await createEncryptedRoom(alicePhone, [bob.api]);
    // Sent once Bob's Hub device exists, so that it gets the room key.
    const bobChat = await hub.open(bob);
    await bobChat.openConversation(alice.displayName);
    const text = uniqueText("React before verifying");
    await alicePhone.sendText(roomId, text);
    await bobChat.timeline.expectMessage(text);
    await bobChat.composer.expectBlocked();

    await bobChat.timeline.react(text, "👍");
    await alice.api.waitForEvent(
      roomId,
      (event) => event.type === "m.reaction" && event.sender === bob.userId,
    );
    await bobChat.reload();
    await bobChat.openConversation(alice.displayName);
    await bobChat.timeline.expectReaction(text, "👍", { count: 1, mine: true });
  });

  test("keeps a reaction another client sent encrypted", async ({
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
    const text = uniqueText("Encrypted reaction");
    const eventId = await alicePhone.sendText(roomId, text);
    await bobChat.timeline.expectMessage(text);

    await alicePhone.sendEncryptedReaction(roomId, eventId, "👍");
    await bobChat.timeline.expectReaction(text, "👍", {
      count: 1,
      mine: false,
    });

    await test.step("a later reaction keeps it", async () => {
      await bob.api.react(roomId, eventId, "✅");
      await bobChat.timeline.expectReaction(text, "✅", {
        count: 1,
        mine: true,
      });
      await bobChat.timeline.expectReactionOrder(text, ["👍", "✅"]);
    });

    await test.step("a reload keeps it", async () => {
      await bobChat.reload();
      await bobChat.openConversation(alice.displayName);
      await bobChat.timeline.expectReactionOrder(text, ["👍", "✅"]);
      await bobChat.page.waitForTimeout(3_000);
      await bobChat.timeline.expectReactionOrder(text, ["👍", "✅"]);
    });
  });
});
