import { faker } from "@faker-js/faker/locale/fr";

import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatThread,
  ChatThreadDetail,
} from "@/features/drivers/types";

// Root messages are pinned to fixed offsets from the end of the conversation
// so the thread buttons land in the first loaded page — and thus on screen.
// 0-based, counted back from the last message.
const THREAD_ROOT_OFFSETS = [2, 7, 14, 24];

// The most recent threads always carry unread replies, so every conversation
// exercises the unread banner and the "mark all as read" action.
const UNREAD_THREAD_COUNT = 2;

export type GeneratedThreads = {
  threads: ChatThread[];
  details: Map<string, ChatThreadDetail>;
};

const buildReply = (
  threadId: string,
  index: number,
  authorId: string,
  timestampMs: number,
): ChatMessage => ({
  id: `${threadId}-r${index + 1}`,
  authorId,
  content: faker.lorem.sentence(),
  timestamp: new Date(timestampMs).toISOString(),
  reactions: [],
});

/**
 * Derives the threads of a conversation from its already-generated messages.
 * Consumes the per-chat `faker` sequence seeded by `mockMessages`, so the
 * result is deterministic per chat. Mutates the chosen root messages to attach
 * their `thread` summary — the bubble renders its thread button straight from
 * the message object.
 */
export const buildChatThreads = (
  chatId: string,
  messages: ChatMessage[],
  authors: ChatMessageAuthor[],
): GeneratedThreads => {
  const threads: ChatThread[] = [];
  const details = new Map<string, ChatThreadDetail>();

  // Reply author pool: every named chat author plus the current user.
  const authorPool = [...authors.map((author) => author.id), "me"];

  THREAD_ROOT_OFFSETS.forEach((offset, threadIndex) => {
    const root = messages[messages.length - 1 - offset];
    if (!root) {
      return;
    }
    const threadId = `thread-${chatId}-${threadIndex}`;
    const replyCount = faker.number.int({ min: 2, max: 60 });

    const replies: ChatMessage[] = [];
    let cursorMs = new Date(root.timestamp).getTime();
    for (let index = 0; index < replyCount; index += 1) {
      cursorMs += faker.number.int({ min: 1, max: 30 }) * 60 * 1000;
      // The last reply must come from a named author so the list row can show
      // a proper avatar — the current user has no author record.
      const authorId =
        index === replyCount - 1
          ? faker.helpers.arrayElement(authors).id
          : faker.helpers.arrayElement(authorPool);
      replies.push(buildReply(threadId, index, authorId, cursorMs));
    }

    const lastReply = replies[replies.length - 1];
    const lastReplyAuthor =
      authors.find((author) => author.id === lastReply.authorId) ?? authors[0];

    threads.push({
      id: threadId,
      rootMessageId: root.id,
      author: lastReplyAuthor,
      lastReplyAt: lastReply.timestamp,
      lastReplyPreview: lastReply.content,
      replyCount,
      unreadCount: 0,
    });
    details.set(threadId, {
      id: threadId,
      rootMessageId: root.id,
      messages: [root, ...replies],
      authors,
      firstUnreadIndex: null,
    });
  });

  // Most recent threads first.
  threads.sort((a, b) => b.lastReplyAt.localeCompare(a.lastReplyAt));

  // Flag the most recent threads as unread.
  threads.slice(0, UNREAD_THREAD_COUNT).forEach((thread) => {
    const detail = details.get(thread.id);
    if (!detail) {
      return;
    }
    const unreadCount = Math.min(
      thread.replyCount,
      faker.number.int({ min: 1, max: 5 }),
    );
    thread.unreadCount = unreadCount;
    // messages[0] is the root; the last `unreadCount` messages are unread.
    detail.firstUnreadIndex = detail.messages.length - unreadCount;
  });

  // Attach the thread summary to each root message.
  threads.forEach((thread) => {
    const root = messages.find(
      (message) => message.id === thread.rootMessageId,
    );
    if (root) {
      root.thread = {
        id: thread.id,
        replyCount: thread.replyCount,
        unreadCount: thread.unreadCount,
      };
    }
  });

  return { threads, details };
};
