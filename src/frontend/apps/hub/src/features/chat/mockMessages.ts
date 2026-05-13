import { faker } from "@faker-js/faker/locale/fr";

import {
  type ChatMessage,
  type ChatMessageAuthor,
} from "@/features/drivers/types";
import { AVATAR_COLORS } from "@/features/ui/components/avatar/palette";

import { type MockChat, getMockChat } from "./mockChats";

const MESSAGES_PER_CHAT = 500;
// Spread the conversation across roughly the last working day so timestamps
// stay readable but still test the same-day grouping logic.
const CONVERSATION_START = new Date("2026-05-12T08:00:00Z").getTime();
const MAX_GAP_MINUTES = 5;

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

const buildMessagesForChat = (authors: ChatMessageAuthor[]): ChatMessage[] => {
  const pool: { weight: number; value: string }[] = [
    { weight: 2 * authors.length, value: "me" },
    ...authors.map((author) => ({ weight: 3, value: author.id })),
  ];

  const messages: ChatMessage[] = [];
  let cursorMs = CONVERSATION_START;

  for (let index = 0; index < MESSAGES_PER_CHAT; index += 1) {
    cursorMs +=
      faker.number.int({ min: 0, max: MAX_GAP_MINUTES }) * 60 * 1000;
    messages.push({
      id: `m-${index + 1}`,
      authorId: faker.helpers.weightedArrayElement(pool),
      content: buildContent(),
      timestamp: new Date(cursorMs).toISOString(),
    });
  }

  return messages;
};

type GeneratedChat = {
  messages: ChatMessage[];
  authors: ChatMessageAuthor[];
};

const chatCache = new Map<string, GeneratedChat>();

const generateForChat = (chat: MockChat): GeneratedChat => {
  faker.seed(seedFromString(chat.id));
  const authors = buildAuthorsForChat(chat);
  return { authors, messages: buildMessagesForChat(authors) };
};

const ensureGenerated = (chatId: string): GeneratedChat | null => {
  const cached = chatCache.get(chatId);
  if (cached) {
    return cached;
  }
  const chat = getMockChat(chatId);
  if (!chat) {
    return null;
  }
  const generated = generateForChat(chat);
  chatCache.set(chatId, generated);
  return generated;
};

export const getMockMessages = (chatId: string): ChatMessage[] =>
  ensureGenerated(chatId)?.messages ?? [];

export const getMockAuthorsForChat = (
  chatId: string,
): ChatMessageAuthor[] => ensureGenerated(chatId)?.authors ?? [];
