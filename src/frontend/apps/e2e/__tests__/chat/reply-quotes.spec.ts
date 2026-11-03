import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom } from "./utils/flows";
import { uniqueId, uniqueText } from "./utils/ids";

/**
 * Messages between a reply and the message it answers: more than the Hub
 * loads on opening the conversation, so the quote and the jump load it.
 */
const MORE_THAN_LOADED = 160;

/**
 * Replies sent from Tchap with "Reply". The Hub sends none itself: they come
 * from the API, as Tchap sends them, and the Hub quotes the answered message
 * above the reply, then goes to it when the quote is clicked.
 */
test.describe("Reply quotes", () => {
  test("quotes the answered message and its author", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob, carol]);
    const question = uniqueText("Carol asks");
    const questionId = await carol.api.sendText(roomId, question);
    const mine = uniqueText("Alice writes");
    const mineId = await alice.api.sendText(roomId, mine);
    // Older clients also put a quote in the reply, in its text and its HTML.
    const toCarol = uniqueText("Bob answers Carol");
    await bob.api.sendReply(roomId, questionId, toCarol, {
      fallback: { sender: carol.userId, body: question },
    });
    const toAlice = uniqueText("Bob answers Alice");
    await bob.api.sendReply(roomId, mineId, toAlice, {
      fallback: { sender: alice.userId, body: mine, html: true },
    });

    const chat = await hub.open(alice);
    await chat.openConversation({ roomId });
    const { timeline } = chat;
    await timeline.expectMessage(toAlice);

    await test.step("the quote names the author, or You", async () => {
      await timeline.expectQuote(toCarol, {
        author: carol.displayName,
        quoted: question,
      });
      await timeline.expectQuote(toAlice, { author: "You", quoted: mine });
    });

    await test.step("the quote older clients add is not repeated", async () => {
      await expect(timeline.body(toCarol)).not.toContainText(question);
      await expect(timeline.body(toAlice)).not.toContainText(mine);
    });

    await test.step("a reply arriving live shows its quote", async () => {
      const live = uniqueText("Carol answers live");
      await carol.api.sendReply(roomId, mineId, live);
      await timeline.expectQuote(live, { author: "You", quoted: mine });
    });

    await test.step("a message without reply has no quote", async () => {
      await expect(timeline.quote(question)).toHaveCount(0);
    });
  });

  test("follows the answered message when edited or deleted", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob, carol]);
    const gone = uniqueText("Bob says something");
    const goneId = await bob.api.sendText(roomId, gone);
    const toGone = uniqueText("Carol answers the deleted message");
    await carol.api.sendReply(roomId, goneId, toGone);
    await bob.api.redact(roomId, goneId);
    const toUnknown = uniqueText("Carol answers an unknown message");
    await carol.api.sendReply(roomId, `$unknown${uniqueId()}`, toUnknown);
    const changing = uniqueText("Bob drafts");
    const changingId = await bob.api.sendText(roomId, changing);
    const toChanging = uniqueText("Carol answers the draft");
    await carol.api.sendReply(roomId, changingId, toChanging);

    const chat = await hub.open(alice);
    await chat.openConversation({ roomId });
    const { timeline } = chat;
    await timeline.expectMessage(toChanging);

    await test.step("a deleted message is quoted as deleted", async () => {
      await timeline.expectQuote(toGone, {
        author: bob.displayName,
        quoted: "Message deleted",
      });
    });

    await test.step("a message that cannot be loaded is unavailable", async () => {
      await timeline.expectQuote(toUnknown, { quoted: "Message unavailable" });
      await expect(timeline.quoteJump(toUnknown)).toHaveCount(0);
    });

    await test.step("an edit shows in the quote", async () => {
      await timeline.expectQuote(toChanging, {
        author: bob.displayName,
        quoted: changing,
      });
      const edited = uniqueText("Bob's final version");
      await bob.api.edit(roomId, changingId, edited);
      await timeline.expectQuote(toChanging, {
        author: bob.displayName,
        quoted: edited,
      });
    });

    await test.step("a deletion shows in the quote", async () => {
      await bob.api.redact(roomId, changingId);
      await timeline.expectQuote(toChanging, {
        author: bob.displayName,
        quoted: "Message deleted",
      });
    });
  });

  test("goes to the answered message from its quote", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob, carol]);
    const far = uniqueText("Bob's first message");
    const farId = await bob.api.sendText(roomId, far);
    await bob.api.sendMany(roomId, uniqueText("Bob"), MORE_THAN_LOADED);
    const near = uniqueText("Bob's recent message");
    const nearId = await bob.api.sendText(roomId, near);
    const other = uniqueText("Carol's recent message");
    const otherId = await carol.api.sendText(roomId, other);
    await bob.api.sendMany(roomId, uniqueText("Bob again"), 3);
    const toFar = uniqueText("Carol answers the first message");
    await carol.api.sendReply(roomId, farId, toFar);
    const toNear = uniqueText("Carol answers the recent message");
    await carol.api.sendReply(roomId, nearId, toNear);
    const toOther = uniqueText("Bob answers Carol");
    await bob.api.sendReply(roomId, otherId, toOther);

    const chat = await hub.open(alice);
    await chat.openConversation({ roomId });
    const { timeline } = chat;
    await timeline.expectMessage(toOther);

    await test.step("a loaded message is selected in view", async () => {
      await timeline.quoteJump(toNear).click();
      await timeline.expectSelected(near);
    });

    await test.step("the selection moves to the next one, from the keyboard", async () => {
      await timeline.expectMessageBelow(toOther);
      await timeline.quoteJump(toOther).focus();
      await timeline.page.keyboard.press("Enter");
      await timeline.expectSelected(other);
      await expect(timeline.message(near)).not.toHaveAttribute(
        "data-highlighted",
      );
    });

    await test.step("a message far above is loaded around it", async () => {
      await timeline.expectQuote(toFar, {
        author: bob.displayName,
        quoted: far,
      });
      await timeline.quoteJump(toFar).click();
      await timeline.expectSelected(far);
    });
  });

  test("quotes within a thread, not the reply every thread message carries", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob, carol]);
    const root = uniqueText("Bob starts a thread");
    const rootId = await bob.api.sendText(roomId, root);
    // A thread message also replies to the previous one, for clients without
    // threads: it is no reply to quote.
    const first = uniqueText("Carol answers in the thread");
    const firstId = await carol.api.sendText(roomId, first, {
      threadRootId: rootId,
    });
    const second = uniqueText("Bob answers Carol in the thread");
    await bob.api.sendReply(roomId, firstId, second, { threadRootId: rootId });

    const chat = await hub.open(alice);
    await chat.openConversation({ roomId });
    await chat.timeline.threadButton(root).click();
    await chat.threads.expectThread(root);
    const { timeline } = chat.threads;
    await timeline.expectMessage(second);

    await expect(timeline.quote(first)).toHaveCount(0);
    await timeline.expectQuote(second, {
      author: carol.displayName,
      quoted: first,
    });

    await test.step("the quote goes to the message in the thread", async () => {
      await timeline.quoteJump(second).click();
      await timeline.expectSelected(first);
    });
  });
});
