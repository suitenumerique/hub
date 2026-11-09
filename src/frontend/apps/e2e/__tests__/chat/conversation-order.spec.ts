import { expect, type Person, test } from "./utils/fixtures";
import { pngImage } from "./utils/files";
import { createUnencryptedRoom } from "./utils/flows";
import { uniqueText } from "./utils/ids";
import type { ChatPage } from "./utils/pages/chat-page";

/** Time left to the list to move a row it should not, before saying it did not. */
const SETTLE_MS = 1_500;

/** A direct chat of Bob, named after the other person. */
type Witness = { person: Person; roomId: string };

type Scene = {
  alice: Person;
  bob: Person;
  carol: Person;
  dave: Person;
  roomId: string;
  roomName: string;
  messageId: string;
  pollId: string;
  /** Lower one first: Dave wrote last. */
  witnesses: [Witness, Witness];
};

/** A poll as Element and Tchap start one (MSC3381). */
const POLL_START = {
  "org.matrix.msc3381.poll.start": {
    question: { "org.matrix.msc1767.text": "Lunch?" },
    kind: "org.matrix.msc3381.poll.disclosed",
    max_selections: 1,
    answers: [
      { id: "yes", "org.matrix.msc1767.text": "Yes" },
      { id: "no", "org.matrix.msc1767.text": "No" },
    ],
  },
  "org.matrix.msc1767.text": "Lunch?\n1. Yes\n2. No",
};

/**
 * Bob's list: a group with Alice and Carol at the bottom, with a message and a
 * poll, then direct chats with Carol and Dave, active later.
 */
const createScene = async (people: {
  create: (name: string) => Promise<Person>;
}): Promise<Scene> => {
  const alice = await people.create("Alice");
  const bob = await people.create("Bob");
  const carol = await people.create("Carol");
  const dave = await people.create("Dave");
  const roomName = uniqueText("Group");
  const roomId = await createUnencryptedRoom(alice, [bob, carol], {
    name: roomName,
  });
  const messageId = await alice.api.sendText(roomId, uniqueText("Hello"));
  const pollId = await alice.api.sendEvent(
    roomId,
    "org.matrix.msc3381.poll.start",
    POLL_START,
  );
  const witnesses: [Witness, Witness] = [
    { person: carol, roomId: await createUnencryptedRoom(carol, [bob]) },
    { person: dave, roomId: await createUnencryptedRoom(dave, [bob]) },
  ];
  for (const { person, roomId: witnessId } of witnesses) {
    await person.api.sendText(witnessId, uniqueText("Witness"));
  }
  return {
    alice,
    bob,
    carol,
    dave,
    roomId,
    roomName,
    messageId,
    pollId,
    witnesses,
  };
};

const expectLast = async (chat: ChatPage, name: string): Promise<void> => {
  await expect(
    chat.leftPanel.rows().last().getByRole("link"),
  ).toHaveAccessibleName(name);
};

/**
 * Brings the lower direct chat to the top with a new message. Once it shows
 * there, Bob's Hub has received everything sent before, in the group too:
 * after a moment to place it, the group must still be at the bottom.
 */
const witnessesOf = (chat: ChatPage, scene: Scene) => {
  const [lower, upper] = scene.witnesses;
  const order = { lower, upper };
  return {
    lower: () => order.lower,
    expectGroupStaysLast: async () => {
      const { person, roomId } = order.lower;
      await person.api.sendText(roomId, uniqueText("Witness"));
      await chat.leftPanel.expectFirst(person.displayName);
      [order.lower, order.upper] = [order.upper, order.lower];
      await chat.page.waitForTimeout(SETTLE_MS);
      await expectLast(chat, scene.roomName);
    },
  };
};

test.describe("Conversation order", () => {
  test("the events Element and Tchap leave out move nothing", async ({
    people,
    hub,
  }) => {
    const scene = await createScene(people);
    const { alice, bob, carol, dave, roomId, roomName, messageId, pollId } =
      scene;
    const chat = await hub.open(bob);
    await chat.leftPanel.expectConversation(roomName);
    await expectLast(chat, roomName);
    const witnesses = witnessesOf(chat, scene);

    await test.step("someone changing their avatar and name moves nothing", async () => {
      const avatarUrl = await alice.api.upload(
        pngImage(alice.userId),
        "image/png",
        "avatar.png",
      );
      await alice.api.setProfile({
        avatarUrl,
        displayName: uniqueText("Alice renamed"),
      });
      await witnesses.expectGroupStaysLast();
    });

    await test.step("someone joining, then leaving, moves nothing", async () => {
      await alice.api.invite(roomId, dave.userId);
      await dave.api.join(roomId);
      await dave.api.leave(roomId);
      await witnesses.expectGroupStaysLast();
    });

    await test.step("an edit moves nothing", async () => {
      await alice.api.edit(roomId, messageId, uniqueText("Hello again"));
      await witnesses.expectGroupStaysLast();
    });

    await test.step("a vote moves nothing", async () => {
      await carol.api.sendEvent(roomId, "org.matrix.msc3381.poll.response", {
        "m.relates_to": { rel_type: "m.reference", event_id: pollId },
        "org.matrix.msc3381.poll.response": { answers: ["yes"] },
      });
      await witnesses.expectGroupStaysLast();
    });

    await test.step("a change of rights moves nothing, as in Tchap", async () => {
      const path = `/_matrix/client/v3/rooms/${roomId}/state/m.room.power_levels/`;
      const levels = await alice.api.request<{ users?: object }>("GET", path);
      await alice.api.sendState(roomId, "m.room.power_levels", {
        ...levels,
        users: { ...levels.users, [carol.userId]: 50 },
      });
      await witnesses.expectGroupStaysLast();
    });

    await test.step("changing your own avatar and name elsewhere moves nothing", async () => {
      const avatarUrl = await bob.api.upload(
        pngImage(bob.userId),
        "image/png",
        "avatar.png",
      );
      await bob.api.setProfile({
        avatarUrl,
        displayName: uniqueText("Bob renamed"),
      });
      await witnesses.expectGroupStaysLast();
    });

    await test.step("the list read again after a reload agrees", async () => {
      await chat.reload();
      await chat.leftPanel.expectConversation(roomName);
      await chat.page.waitForTimeout(SETTLE_MS);
      await expectLast(chat, roomName);
    });

    await test.step("a new message from someone else moves it up", async () => {
      await alice.api.sendText(roomId, uniqueText("News"));
      await chat.leftPanel.expectFirst(roomName);
    });

    await test.step("a message of your own moves a chat up", async () => {
      const { person } = witnesses.lower();
      await expectLast(chat, person.displayName);
      await chat.openConversation(person.displayName);
      await chat.composer.send(uniqueText("From Bob"));
      await chat.leftPanel.expectFirst(person.displayName);
    });

    await test.step("a new topic moves it up, as Element shows it", async () => {
      await alice.api.sendState(roomId, "m.room.topic", {
        topic: uniqueText("Topic"),
      });
      await chat.leftPanel.expectFirst(roomName);
    });
  });
});
