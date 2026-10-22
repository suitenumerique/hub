import { expect, test } from "./utils/fixtures";
import { createUnencryptedRoom } from "./utils/flows";
import { uniqueId, uniqueText } from "./utils/ids";
import type { ChatPage } from "./utils/pages/chat-page";

/** What one query must find, and what it must not. */
type SearchCase = { query: string; found: string[]; notFound: string[] };

/** Runs every query in a freshly opened search dialog. */
const expectSearchResults = async (
  chat: ChatPage,
  cases: SearchCase[],
): Promise<void> => {
  await chat.search.open();
  for (const { query, found, notFound } of cases) {
    await chat.search.search(query);
    await chat.search.expectPreparationComplete();
    for (const name of found) await chat.search.expectResult(name);
    for (const name of notFound) await chat.search.expectNoResult(name);
  }
  await chat.search.close();
};

/**
 * E2E-17: conversation search, backed by a local IndexedDB projection whose
 * participants are prepared in the background.
 */
test("finds conversations by name and by member", async ({ people, hub }) => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const carol = await people.create("Carol");
  const dave = await people.create("Dave");
  const directRoomId = await createUnencryptedRoom(alice, [bob]);
  const directMessage = uniqueText("In the direct chat");
  await bob.api.sendText(directRoomId, directMessage);
  const project = `Project ${uniqueId()}`;
  const projectRoomId = await createUnencryptedRoom(alice, [bob, carol], {
    name: project,
  });

  const chat = await hub.open(alice);
  await chat.leftPanel.expectConversation(bob.displayName);

  await test.step("a direct chat by the other person's name", async () => {
    await chat.leftPanel.searchButton.click();
    await chat.search.search(bob.displayName);
    await chat.search.expectResult(bob.displayName);
    await chat.search.close();
  });

  const late = `Late ${uniqueId()}`;

  await test.step("a conversation joined now is searchable", async () => {
    const lateRoomId = await dave.api.createRoom({
      name: late,
      invite: [alice.userId, carol.userId],
    });
    await carol.api.join(lateRoomId);
    await alice.api.join(lateRoomId);
    await chat.leftPanel.expectConversation(late);
    await expectSearchResults(chat, [
      { query: late, found: [late], notFound: [project] },
    ]);
  });

  // Each conversation found by its name, and the groups by a member's name
  // once their participants are prepared.
  const searches: SearchCase[] = [
    { query: bob.displayName, found: [bob.displayName], notFound: [late] },
    { query: carol.displayName, found: [project, late], notFound: [] },
    { query: dave.displayName, found: [late], notFound: [project] },
    { query: project, found: [project], notFound: [bob.displayName] },
  ];

  await test.step("a group by a member's name, once prepared", async () => {
    await expectSearchResults(chat, searches);
  });

  await test.step("the same results come back after a reload", async () => {
    await chat.reload();
    await expectSearchResults(chat, searches);
  });

  await test.step("opening a result opens the conversation", async () => {
    await chat.search.open();
    await chat.search.search(bob.displayName);
    await chat.search.openResult(bob.displayName);
    await chat.expectConversationUrl(directRoomId);
    await expect(chat.leftPanel.conversation(bob.displayName)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await chat.header.expectTitle(bob.displayName);
    await chat.timeline.expectMessage(directMessage);
  });

  await test.step("a left conversation is no longer found", async () => {
    await alice.api.leave(projectRoomId);
    await chat.leftPanel.expectNoConversation(project);
    await expectSearchResults(chat, [
      { query: project, found: [], notFound: [project] },
      { query: carol.displayName, found: [late], notFound: [project] },
    ]);
  });

  await test.step("the next person on this browser finds nothing", async () => {
    await chat.accountMenu.logout();
    const erin = await people.create("Erin");
    const erinChat = await hub.open(erin, { context: chat.page.context() });
    await erinChat.search.open();
    for (const query of [bob.displayName, carol.displayName, late]) {
      await erinChat.search.search(query);
      await erinChat.search.expectNoChatsFound();
    }
  });
});
