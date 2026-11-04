import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom, signInAgain } from "./utils/flows";
import { signInToHubBackend } from "./utils/hub-session";
import { uniqueText } from "./utils/ids";
import { SEND_REQUESTS } from "./utils/network";
import { ChatPage } from "./utils/pages/chat-page";

/** The text of every draft this browser keeps on disk. */
const draftsOnDisk = (chat: ChatPage): Promise<string[]> =>
  chat.page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("hubComposerDraft:"))
      .map(
        (key) => JSON.parse(localStorage.getItem(key) ?? "{}").text as string,
      ),
  );

/** E2E-20: what is being written stays, until it is sent. */
test.describe("Composer drafts", () => {
  test("keeps a draft per conversation until it is sent", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    await createUnencryptedRoom(alice, [carol]);
    const forBob = uniqueText("For Bob");
    const forCarol = uniqueText("For Carol");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.composer.type(forBob);

    await test.step("another conversation has its own draft", async () => {
      await chat.openConversation(carol.displayName);
      await expect(chat.composer.field).toHaveValue("");
      await chat.composer.type(forCarol);
    });

    await test.step("coming back finds each draft", async () => {
      await chat.openConversation(bob.displayName);
      await expect(chat.composer.field).toHaveValue(forBob);
      await chat.openConversation(carol.displayName);
      await expect(chat.composer.field).toHaveValue(forCarol);
    });

    await test.step("a new conversation starts from an empty field", async () => {
      await chat.leftPanel.openNewChat();
      await expect(chat.composer.field).toHaveValue("");
      await chat.openConversation(carol.displayName);
      await expect(chat.composer.field).toHaveValue(forCarol);
    });

    await test.step("drafts survive a reload", async () => {
      await chat.reload();
      await expect(chat.composer.field).toHaveValue(forCarol);
      await chat.openConversation(bob.displayName);
      await expect(chat.composer.field).toHaveValue(forBob);
    });

    const reopened =
      await test.step("drafts survive closing the tab", async () => {
        const context = chat.page.context();
        const url = chat.page.url();
        await chat.page.close();
        const tab = new ChatPage(await context.newPage(), alice);
        await tab.goto(url);
        await expect(tab.composer.field).toHaveValue(forBob);
        return tab;
      });

    await test.step("sending clears the draft for good", async () => {
      await reopened.composer.sendDraft();
      await bob.api.waitForText(roomId, forBob);
      await reopened.timeline.expectMessageOnce(forBob);
      await reopened.reload();
      await expect(reopened.composer.field).toHaveValue("");
    });

    await test.step("the other draft stays", async () => {
      await reopened.openConversation(carol.displayName);
      await expect(reopened.composer.field).toHaveValue(forCarol);
    });
  });

  test("keeps a thread's draft apart from the conversation's", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const root = uniqueText("Root");
    const otherRoot = uniqueText("Other root");
    await alice.api.sendText(roomId, root);
    await alice.api.sendText(roomId, otherRoot);
    const conversationDraft = uniqueText("Conversation draft");
    const threadDraft = uniqueText("Thread draft");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.composer.type(conversationDraft);
    await chat.timeline.reply(root);
    await chat.threads.expectThread(root);
    await expect(chat.threads.composer.field).toHaveValue("");
    await chat.threads.composer.type(threadDraft);

    await test.step("closing and opening the thread finds it", async () => {
      await chat.threads.backToList();
      await chat.timeline.reply(root);
      await expect(chat.threads.composer.field).toHaveValue(threadDraft);
      await expect(chat.composer.field).toHaveValue(conversationDraft);
    });

    await test.step("another thread has its own draft", async () => {
      await chat.timeline.reply(otherRoot);
      await expect(chat.threads.composer.field).toHaveValue("");
    });

    await test.step("both survive a reload", async () => {
      await chat.reload();
      await expect(chat.composer.field).toHaveValue(conversationDraft);
      await chat.timeline.reply(root);
      await expect(chat.threads.composer.field).toHaveValue(threadDraft);
    });

    await test.step("sending clears only the thread's", async () => {
      await chat.threads.composer.sendDraft();
      await chat.threads.timeline.expectMessageOnce(threadDraft);
      await chat.threads.backToList();
      await chat.timeline.reply(root);
      await expect(chat.threads.composer.field).toHaveValue("");
      await expect(chat.composer.field).toHaveValue(conversationDraft);
    });
  });

  test("keeps the mentions of a draft", async ({ people, hub }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const [firstName] = bob.displayName.split(" ");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.composer.mention(firstName, bob.displayName);
    await expect(chat.composer.draftMention).toHaveText(bob.displayName);
    await chat.composer.field.press("End");
    await chat.composer.field.pressSequentially(uniqueText("look"));
    const text = await chat.composer.field.inputValue();

    await chat.reload();
    await expect(chat.composer.field).toHaveValue(text);
    await expect(chat.composer.draftMention).toHaveText(bob.displayName);

    await chat.composer.sendDraft();
    const received = await bob.api.waitForText(roomId, text);
    expect(received.content["m.mentions"]).toEqual({ user_ids: [bob.userId] });
  });

  test("sets a draft aside while a message is edited", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    const sent = uniqueText("Sent");
    await alice.api.sendText(roomId, sent);
    const draft = uniqueText("Draft");
    const edited = uniqueText("Edited");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    await chat.timeline.expectMessage(sent);
    await chat.composer.type(draft);

    await test.step("cancelling the edit gives it back", async () => {
      await chat.timeline.pickAction(sent, "Edit");
      await expect(chat.composer.field).toHaveValue(sent);
      await expect(chat.composer.editingStatus).toBeVisible();
      await chat.composer.field.press("Escape");
      await expect(chat.composer.field).toHaveValue(draft);
      await expect(chat.composer.editingStatus).toBeHidden();
    });

    await test.step("the edited text is not a draft", async () => {
      await chat.timeline.pickAction(sent, "Edit");
      await expect(chat.composer.field).toHaveValue(sent);
      await chat.reload();
      await expect(chat.composer.field).toHaveValue(draft);
      await expect(chat.composer.editingStatus).toBeHidden();
    });

    await test.step("saving the edit gives it back", async () => {
      await chat.timeline.pickAction(sent, "Edit");
      await chat.composer.field.fill(edited);
      await chat.composer.field.press("Enter");
      await expect(chat.composer.field).toHaveValue(draft);
      await chat.timeline.expectEdited(edited);
    });
  });

  test("gives a refused message back to its conversation", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    await createUnencryptedRoom(alice, [carol]);
    const text = uniqueText("Refused");

    const chat = await hub.open(alice);
    await chat.openConversation(bob.displayName);
    // The SDK logs the failure, which opens the dev overlay above the page.
    await chat.page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    let refuse = () => {};
    const refusal = new Promise<void>((resolve) => {
      refuse = resolve;
    });
    await chat.page.route(SEND_REQUESTS, async (route) => {
      await refusal;
      await route.fulfill({
        status: 403,
        json: { errcode: "M_FORBIDDEN", error: "Refused" },
      });
    });
    await chat.composer.send(text);

    await test.step("it never lands in the conversation left meanwhile", async () => {
      await chat.openConversation(carol.displayName);
      refuse();
      await expect(
        chat.page.getByText("Your message could not be sent."),
      ).toBeVisible();
      await expect(chat.composer.field).toHaveValue("");
    });

    await test.step("it waits in its own conversation", async () => {
      await chat.page.unroute(SEND_REQUESTS);
      await chat.openConversation(bob.displayName);
      await expect(chat.composer.field).toHaveValue(text);
      await chat.composer.sendDraft();
      await bob.api.waitForText(roomId, text);
    });
  });

  test("erases the drafts of a conversation on leaving it", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    const carol = await people.create("Carol");
    const roomId = await createUnencryptedRoom(alice, [bob]);
    await createUnencryptedRoom(alice, [carol]);
    const root = uniqueText("Root");
    await alice.api.sendText(roomId, root);
    const kept = uniqueText("Kept");

    const chat = await hub.open(alice);
    await chat.openConversation(carol.displayName);
    await chat.composer.type(kept);
    await chat.openConversation(bob.displayName);
    await chat.composer.type(uniqueText("Conversation draft"));
    await chat.timeline.reply(root);
    await chat.threads.composer.type(uniqueText("Thread draft"));
    expect(await draftsOnDisk(chat)).toHaveLength(3);

    await chat.header.leave(bob.displayName);
    await expect.poll(() => draftsOnDisk(chat)).toEqual([kept]);
  });

  test("keeps drafts to their author on a shared browser, until logout", async ({
    people,
    hub,
  }) => {
    const alice = await people.create("Alice");
    const bob = await people.create("Bob");
    await createUnencryptedRoom(alice, [bob]);
    const draft = uniqueText("Draft");

    const aliceChat = await hub.open(alice);
    const context = aliceChat.page.context();
    await aliceChat.openConversation(bob.displayName);
    await aliceChat.composer.type(draft);
    const url = aliceChat.page.url();
    await aliceChat.page.close();

    await test.step("someone else on this browser does not see it", async () => {
      const bobChat = await hub.open(bob, { context });
      await bobChat.openConversation(alice.displayName);
      await expect(bobChat.composer.field).toHaveValue("");
      await bobChat.page.close();
    });

    const aliceBack = new ChatPage(await context.newPage(), alice);

    await test.step("its author finds it on coming back", async () => {
      await signInToHubBackend(context, alice);
      await aliceBack.goto(url);
      await expect(aliceBack.composer.field).toHaveValue(draft);
    });

    await test.step("logging out erases it from the disk", async () => {
      await aliceBack.accountMenu.logout();
      expect(await draftsOnDisk(aliceBack)).toEqual([]);
      await signInAgain(aliceBack);
      await aliceBack.openConversation(bob.displayName);
      await expect(aliceBack.composer.field).toHaveValue("");
    });
  });
});
