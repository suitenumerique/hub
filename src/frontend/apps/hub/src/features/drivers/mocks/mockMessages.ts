import { faker } from "@faker-js/faker/locale/fr";

import { toggleReaction } from "@/features/chat/reactions";
import {
  type ChatMessage,
  type ChatMessageAuthor,
  type ChatReaction,
  type ChatThread,
  type ChatThreadDetail,
  type ChatThreadMutationResult,
} from "@/features/drivers/types";
import { AVATAR_COLORS } from "@/features/ui/components/avatar/palette";

import { type MockChat, getMockChat } from "./mockChats";
import { buildChatThreads } from "./mockThreads";

const MESSAGES_PER_CHAT = 500;
// Spread the conversation across roughly the last working day so timestamps
// stay readable but still test the same-day grouping logic.
const CONVERSATION_START = new Date("2026-05-12T08:00:00Z").getTime();
const MAX_GAP_MINUTES = 5;
const CURRENT_USER_AUTHOR: ChatMessageAuthor = {
  id: "me",
  name: "You",
  initials: "ME",
  color: "blue-1",
};

const seedFromString = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
};

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "author";

const initialsFor = (name: string): string => {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((p) => p.charAt(0).toUpperCase()).join("");
  return letters || "?";
};

const buildAuthorsForChat = (chat: MockChat): ChatMessageAuthor[] => {
  const colors = faker.helpers.shuffle([...AVATAR_COLORS]);

  if (chat.kind === "direct") {
    return [
      {
        id: slugify(chat.name),
        name: chat.name,
        initials: initialsFor(chat.name),
        color: colors[0],
      },
    ];
  }

  // For group chats whose name contains comma-separated participants, seed
  // with those names; otherwise generate synthetic ones.
  const seededNames = chat.name.includes(",")
    ? chat.name
        .split(",")
        .map((piece) => piece.trim())
        .filter((piece) => piece.length > 0)
    : [];

  const targetCount = faker.number.int({ min: 2, max: 4 });
  const names = [...seededNames];
  while (names.length < targetCount) {
    const candidate = faker.person.fullName();
    if (!names.includes(candidate)) {
      names.push(candidate);
    }
  }

  return names.map((name, index) => ({
    id: `${slugify(name)}-${index}`,
    name,
    initials: initialsFor(name),
    color: colors[index % colors.length],
  }));
};

const buildContent = (): string => {
  const roll = faker.number.int({ min: 1, max: 100 });
  if (roll <= 60) {
    return faker.lorem.sentence();
  }
  if (roll <= 90) {
    return faker.lorem.sentences(faker.number.int({ min: 2, max: 4 }));
  }
  return faker.lorem.paragraph();
};

// Small palette for seeded reactions, includes the toolbar quick reactions.
const REACTION_EMOJIS = ["👍", "🎉", "😂", "❤️", "😮", "🙌"];

// Deterministic (driven by the per-chat `faker.seed`): most messages carry no
// reaction, a minority carry one to three so the reactions bar is visible on
// load without flooding the conversation.
const buildReactions = (): ChatReaction[] => {
  if (faker.number.int({ min: 1, max: 100 }) > 25) {
    return [];
  }
  const emojis = faker.helpers.arrayElements(
    REACTION_EMOJIS,
    faker.number.int({ min: 1, max: 3 }),
  );
  return emojis.map((emoji) => {
    const reactedByMe = faker.number.int({ min: 1, max: 100 }) <= 30;
    const others = faker.number.int({ min: reactedByMe ? 0 : 1, max: 4 });
    return { emoji, count: others + (reactedByMe ? 1 : 0), reactedByMe };
  });
};

const buildMessagesForChat = (authors: ChatMessageAuthor[]): ChatMessage[] => {
  const pool: { weight: number; value: string }[] = [
    { weight: 2 * authors.length, value: "me" },
    ...authors.map((author) => ({ weight: 3, value: author.id })),
  ];

  const messages: ChatMessage[] = [];
  let cursorMs = CONVERSATION_START;

  for (let index = 0; index < MESSAGES_PER_CHAT; index += 1) {
    cursorMs += faker.number.int({ min: 0, max: MAX_GAP_MINUTES }) * 60 * 1000;
    messages.push({
      id: `m-${index + 1}`,
      authorId: faker.helpers.weightedArrayElement(pool),
      content: buildContent(),
      timestamp: new Date(cursorMs).toISOString(),
      reactions: buildReactions(),
    });
  }

  return messages;
};

type GeneratedChat = {
  messages: ChatMessage[];
  authors: ChatMessageAuthor[];
  threads: ChatThread[];
  threadDetails: Map<string, ChatThreadDetail>;
};

const chatCache = new Map<string, GeneratedChat>();

const generateForChat = (chat: MockChat): GeneratedChat => {
  faker.seed(seedFromString(chat.id));
  const authors = buildAuthorsForChat(chat);
  const messages = buildMessagesForChat(authors);
  // Threads are derived from the conversation and consume the same seeded
  // `faker` sequence, so they stay deterministic per chat.
  const { threads, details } = buildChatThreads(chat.id, messages, authors);
  return { authors, messages, threads, threadDetails: details };
};

const ensureGenerated = (
  chatId: string,
  chatOverride?: MockChat,
): GeneratedChat | null => {
  const cacheKey = chatOverride?.id ?? chatId;
  const cached = chatCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const chat = chatOverride ?? getMockChat(chatId);
  if (!chat) {
    return null;
  }
  const generated = generateForChat(chat);
  chatCache.set(cacheKey, generated);
  return generated;
};

export const getMockMessages = (
  chatId: string,
  chatOverride?: MockChat,
): ChatMessage[] => ensureGenerated(chatId, chatOverride)?.messages ?? [];

export const getMockAuthorsForChat = (
  chatId: string,
  chatOverride?: MockChat,
): ChatMessageAuthor[] => ensureGenerated(chatId, chatOverride)?.authors ?? [];

const cloneMessage = (message: ChatMessage): ChatMessage => ({
  ...message,
  reactions: [...message.reactions],
  thread: message.thread ? { ...message.thread } : undefined,
});

const cloneThread = (thread: ChatThread): ChatThread => ({
  ...thread,
  author: { ...thread.author },
});

const cloneThreadDetail = (detail: ChatThreadDetail): ChatThreadDetail => ({
  ...detail,
  messages: detail.messages.map(cloneMessage),
  authors: detail.authors.map((author) => ({ ...author })),
});

const nextTimestampAfter = (timestamp: string | undefined): string => {
  const previous = timestamp ? Date.parse(timestamp) : Date.now();
  const base = Number.isFinite(previous) ? previous : Date.now();
  return new Date(base + 60_000).toISOString();
};

const ensureCurrentUserAuthor = (detail: ChatThreadDetail): void => {
  if (!detail.authors.some((author) => author.id === CURRENT_USER_AUTHOR.id)) {
    detail.authors.push(CURRENT_USER_AUTHOR);
  }
};

const sortThreadsByLastReply = (threads: ChatThread[]): void => {
  threads.sort((a, b) => b.lastReplyAt.localeCompare(a.lastReplyAt));
};

const buildThreadMutationResult = (
  generated: GeneratedChat,
  thread: ChatThread,
  detail: ChatThreadDetail,
  message: ChatMessage,
): ChatThreadMutationResult | null => {
  const root = generated.messages.find(
    (candidate) => candidate.id === thread.rootMessageId,
  );
  if (!root) {
    return null;
  }
  return {
    message: cloneMessage(message),
    thread: cloneThread(thread),
    threadDetail: cloneThreadDetail(detail),
    rootMessage: cloneMessage(root),
  };
};

const syncThreadMetadata = (
  generated: GeneratedChat,
  thread: ChatThread,
  detail: ChatThreadDetail,
  message: ChatMessage,
): ChatThreadMutationResult | null => {
  const replyCount = Math.max(0, detail.messages.length - 1);
  thread.author = CURRENT_USER_AUTHOR;
  thread.lastReplyAt = message.timestamp;
  thread.lastReplyPreview = message.content;
  thread.replyCount = replyCount;
  thread.unreadCount = 0;
  detail.firstUnreadIndex = null;

  const root = generated.messages.find(
    (candidate) => candidate.id === thread.rootMessageId,
  );
  if (root) {
    root.thread = {
      id: thread.id,
      replyCount,
      unreadCount: 0,
    };
  }
  sortThreadsByLastReply(generated.threads);
  return buildThreadMutationResult(generated, thread, detail, message);
};

export const sendMockMessage = (
  chatId: string,
  content: string,
  chatOverride?: MockChat,
): ChatMessage | null => {
  const generated = ensureGenerated(chatId, chatOverride);
  if (!generated) {
    return null;
  }
  const last = generated.messages[generated.messages.length - 1];
  const message: ChatMessage = {
    id: `m-${generated.messages.length + 1}`,
    authorId: "me",
    content,
    timestamp: nextTimestampAfter(last?.timestamp),
    reactions: [],
  };
  generated.messages.push(message);
  return cloneMessage(message);
};

export const sendMockThreadReply = (
  chatId: string,
  threadId: string,
  content: string,
  chatOverride?: MockChat,
): ChatThreadMutationResult | null => {
  const generated = ensureGenerated(chatId, chatOverride);
  const detail = generated?.threadDetails.get(threadId);
  const thread = generated?.threads.find(
    (candidate) => candidate.id === threadId,
  );
  if (!generated || !detail || !thread) {
    return null;
  }

  ensureCurrentUserAuthor(detail);
  const last = detail.messages[detail.messages.length - 1];
  const message: ChatMessage = {
    id: `${threadId}-r${detail.messages.length}`,
    authorId: "me",
    content,
    timestamp: nextTimestampAfter(last?.timestamp),
    reactions: [],
  };
  detail.messages.push(message);
  return syncThreadMetadata(generated, thread, detail, message);
};

export const startMockThread = (
  chatId: string,
  rootMessageId: string,
  content: string,
  chatOverride?: MockChat,
): ChatThreadMutationResult | null => {
  const generated = ensureGenerated(chatId, chatOverride);
  const root = generated?.messages.find(
    (candidate) => candidate.id === rootMessageId,
  );
  if (!generated || !root || root.thread) {
    return null;
  }

  const threadId = `thread-${chatOverride?.id ?? chatId}-created-${generated.threadDetails.size}`;
  const message: ChatMessage = {
    id: `${threadId}-r1`,
    authorId: "me",
    content,
    timestamp: nextTimestampAfter(root.timestamp),
    reactions: [],
  };
  const thread: ChatThread = {
    id: threadId,
    rootMessageId,
    author: CURRENT_USER_AUTHOR,
    lastReplyAt: message.timestamp,
    lastReplyPreview: message.content,
    replyCount: 1,
    unreadCount: 0,
  };
  const detail: ChatThreadDetail = {
    id: threadId,
    rootMessageId,
    messages: [root, message],
    authors: [...generated.authors, CURRENT_USER_AUTHOR],
    firstUnreadIndex: null,
  };

  generated.threads.unshift(thread);
  generated.threadDetails.set(threadId, detail);
  root.thread = { id: threadId, replyCount: 1, unreadCount: 0 };
  sortThreadsByLastReply(generated.threads);

  return buildThreadMutationResult(generated, thread, detail, message);
};

/**
 * Toggles the current user's reaction with `emoji` on a stored message and
 * returns a copy of the updated message. The in-memory store is mutated so
 * the change survives pagination refetches, but the returned object is a
 * fresh copy — matching what a real backend would send over the wire and
 * keeping callers safe from accidentally mutating the store. Returns `null`
 * when the chat or message is unknown.
 */
export const toggleMockReaction = (
  chatId: string,
  messageId: string,
  emoji: string,
  chatOverride?: MockChat,
): ChatMessage | null => {
  const message = ensureGenerated(chatId, chatOverride)?.messages.find(
    (candidate) => candidate.id === messageId,
  );
  if (!message) {
    return null;
  }
  message.reactions = toggleReaction(message.reactions, emoji);
  return { ...message };
};

/** Threads of a conversation, most recent first. Returns fresh copies. */
export const getMockThreads = (
  chatId: string,
  chatOverride?: MockChat,
): ChatThread[] =>
  (ensureGenerated(chatId, chatOverride)?.threads ?? []).map((thread) => ({
    ...thread,
  }));

/**
 * Full content of a single thread, or `null` when unknown. Returns a snapshot
 * so a later "mark as read" cannot mutate an already-open detail view.
 */
export const getMockThread = (
  chatId: string,
  threadId: string,
  chatOverride?: MockChat,
): ChatThreadDetail | null => {
  const detail = ensureGenerated(chatId, chatOverride)?.threadDetails.get(
    threadId,
  );
  if (!detail) {
    return null;
  }
  return {
    ...detail,
    messages: [...detail.messages],
    authors: [...detail.authors],
  };
};

/**
 * Clears the unread state of a thread in the in-memory store so the change
 * survives refetches. Returns `false` when the chat or thread is unknown.
 */
export const markMockThreadRead = (
  chatId: string,
  threadId: string,
  chatOverride?: MockChat,
): boolean => {
  const generated = ensureGenerated(chatId, chatOverride);
  const thread = generated?.threads.find(
    (candidate) => candidate.id === threadId,
  );
  const detail = generated?.threadDetails.get(threadId);
  if (!generated || !thread || !detail) {
    return false;
  }
  thread.unreadCount = 0;
  detail.firstUnreadIndex = null;
  const root = generated.messages.find(
    (message) => message.id === thread.rootMessageId,
  );
  if (root?.thread) {
    root.thread = { ...root.thread, unreadCount: 0 };
  }
  return true;
};

/**
 * Toggles the current user's reaction on a message inside a thread (root or
 * reply) and returns a copy of the updated message. The in-memory store is
 * mutated so the change survives refetches; the returned object is a fresh
 * copy. Returns `null` when the message is unknown.
 */
export const toggleMockThreadReaction = (
  chatId: string,
  threadId: string,
  messageId: string,
  emoji: string,
  chatOverride?: MockChat,
): ChatMessage | null => {
  const detail = ensureGenerated(chatId, chatOverride)?.threadDetails.get(
    threadId,
  );
  const message = detail?.messages.find(
    (candidate) => candidate.id === messageId,
  );
  if (!message) {
    return null;
  }
  message.reactions = toggleReaction(message.reactions, emoji);
  return { ...message };
};

/** Clears the unread state of every thread of a conversation. */
export const markAllMockThreadsRead = (
  chatId: string,
  chatOverride?: MockChat,
): void => {
  ensureGenerated(chatId, chatOverride)?.threads.forEach((thread) => {
    markMockThreadRead(chatId, thread.id, chatOverride);
  });
};
