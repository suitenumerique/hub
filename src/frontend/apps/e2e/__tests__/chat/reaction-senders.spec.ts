import { Locator } from "@playwright/test";

import { SYNC_TIMEOUT } from "./utils/env";
import { expect, type Person, test } from "./utils/fixtures";
import { createUnencryptedRoom } from "./utils/flows";
import { uniqueText } from "./utils/ids";
import type { ChatPage } from "./utils/pages/chat-page";

/** Room kept between an unfolded tooltip and the edge of the visible area. */
const VISIBLE_AREA_MARGIN = 40;

const top = async (locator: Locator): Promise<number> =>
  (await locator.boundingBox())!.y;

const bottom = async (locator: Locator): Promise<number> => {
  const box = (await locator.boundingBox())!;
  return box.y + box.height;
};

/**
 * A conversation with more members than Synapse lets a room creation invite
 * at once: they are invited one by one.
 */
const createLargeRoom = async (
  owner: Person,
  members: Person[],
): Promise<string> => {
  const roomId = await createUnencryptedRoom(owner, []);
  for (const member of members) {
    await owner.api.invite(roomId, member.userId);
    await member.api.join(roomId);
  }
  return roomId;
};

/**
 * Unfolds a tooltip of twelve names and checks that it kept its side of the
 * chip, stopped at the margin from the edge of the visible area, and scrolls
 * its own list to the last names, not the conversation.
 */
const expectUnfoldedWithinView = async (
  chat: ChatPage,
  text: string,
  reactors: Person[],
  side: "top" | "bottom",
): Promise<void> => {
  const { timeline, page } = chat;
  const tooltip = await timeline.hoverReaction(text, "🎉");
  await expect(tooltip).toHaveAttribute("data-placement", side);
  const others = tooltip.getByRole("button", { name: "and 6 others" });
  // Folded, the tooltip shows all its lines.
  await expect(others).toBeInViewport();

  await others.click();
  const lines = timeline.reactionSenders(tooltip);
  await expect(lines).toHaveText(reactors.map((person) => person.displayName));
  await expect(tooltip).toHaveAttribute("data-placement", side);

  const chip = timeline.reaction(text, "🎉");
  const scroller = timeline.root.locator("[data-virtuoso-scroller]");
  if (side === "top") {
    expect(await bottom(tooltip)).toBeLessThanOrEqual(await top(chip));
    expect(Math.abs((await top(tooltip)) - VISIBLE_AREA_MARGIN)).toBeLessThan(
      1,
    );
  } else {
    expect(await top(tooltip)).toBeGreaterThanOrEqual(await bottom(chip));
    const limit = (await bottom(scroller)) - VISIBLE_AREA_MARGIN;
    expect(Math.abs((await bottom(tooltip)) - limit)).toBeLessThan(1);
  }

  const conversationScroll = await scroller.evaluate((el) => el.scrollTop);
  await expect(lines.last()).not.toBeInViewport();
  await tooltip.locator(".hub__message-reactions__senders").hover();
  await page.mouse.wheel(0, 400);
  await expect(lines.last()).toBeInViewport();
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(
    conversationScroll,
  );
};

/** Who reacted: the tooltip of a reaction names the people behind it. */
test.describe("Who reacted", () => {
  test("names who reacted, in the order they reacted", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const dave = await people.create("Dave");
    const roomId = await createUnencryptedRoom(alice, [bob, carol, dave]);
    const text = uniqueText("Who reacted");
    const eventId = await alice.api.sendText(roomId, text);
    await bob.api.react(roomId, eventId, "👍");
    await carol.api.react(roomId, eventId, "👍");
    const aliceChat = await hub.open(alice);
    await aliceChat.openConversation({ roomId });
    const { timeline } = aliceChat;
    await timeline.expectReactionSenders(text, "👍", [
      bob.displayName,
      carol.displayName,
    ]);

    await test.step("a reaction arriving live joins the end", async () => {
      await dave.api.react(roomId, eventId, "👍");
      await timeline.expectReactionSenders(text, "👍", [
        bob.displayName,
        carol.displayName,
        dave.displayName,
      ]);
    });

    await test.step("Alice's own reaction comes last, then goes", async () => {
      await timeline.reaction(text, "👍").click();
      await timeline.expectReaction(text, "👍", { count: 4, mine: true });
      await timeline.expectReactionSenders(text, "👍", [
        bob.displayName,
        carol.displayName,
        dave.displayName,
        alice.displayName,
      ]);
      await timeline.reaction(text, "👍").click();
      await timeline.expectReaction(text, "👍", { count: 3, mine: false });
      await timeline.expectReactionSenders(text, "👍", [
        bob.displayName,
        carol.displayName,
        dave.displayName,
      ]);
    });
  });

  test("lists six names, then everyone on click", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const reactors: Person[] = [];
    for (let i = 1; i <= 8; i++) {
      reactors.push(await people.create(`Reactor ${i}`));
    }
    const roomId = await createUnencryptedRoom(alice, reactors);
    const text = uniqueText("Many reactions");
    const eventId = await alice.api.sendText(roomId, text);
    for (const reactor of reactors) {
      await reactor.api.react(roomId, eventId, "🎉");
    }
    const aliceChat = await hub.open(alice);
    await aliceChat.openConversation({ roomId });
    const { timeline } = aliceChat;
    const names = reactors.map((person) => person.displayName);

    await timeline.expectReactionSenders(text, "🎉", [
      ...names.slice(0, 6),
      "and 2 others",
    ]);
    const tooltip = aliceChat.page.getByRole("tooltip");
    await tooltip.getByRole("button", { name: "and 2 others" }).click();
    await expect(timeline.reactionSenders(tooltip)).toHaveText(names);
  });

  test("unfolds on the side it opened, within the visible area", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const reactors: Person[] = [];
    for (let i = 1; i <= 12; i++) {
      reactors.push(await people.create(`Reactor ${i}`));
    }
    const roomId = await createLargeRoom(alice, reactors);
    const text = uniqueText("Unfold me");
    const eventId = await alice.api.sendText(roomId, text);
    for (const reactor of reactors) {
      await reactor.api.react(roomId, eventId, "🎉");
    }
    const aliceChat = await hub.open(alice);
    await aliceChat.openConversation({ roomId });
    const { timeline, page } = aliceChat;
    await timeline.expectReaction(text, "🎉", { count: 12, mine: false });

    await test.step("above a chip low in the conversation", async () => {
      await page.setViewportSize({ width: 1280, height: 300 });
      await expectUnfoldedWithinView(aliceChat, text, reactors, "top");
    });

    await test.step("below a chip near the top of the window", async () => {
      let last = "";
      for (let i = 1; i <= 10; i++) {
        last = uniqueText(`Later ${i}`);
        await reactors[0].api.sendText(roomId, last);
      }
      await timeline.expectMessage(last);
      await page.setViewportSize({ width: 1280, height: 440 });
      // Scroll back up, as a person would, until the chip sits just under
      // the conversation header: there is no room for the tooltip above it.
      const chip = timeline.reaction(text, "🎉");
      await timeline.root.locator("[data-virtuoso-scroller]").hover();
      await expect
        .poll(
          async () => {
            if ((await chip.count()) > 0 && (await top(chip)) >= 80) {
              return true;
            }
            await page.mouse.wheel(0, -40);
            return false;
          },
          { timeout: SYNC_TIMEOUT, intervals: [200] },
        )
        .toBe(true);
      await expectUnfoldedWithinView(aliceChat, text, reactors, "bottom");
    });
  });
});
