import { getMockChat, getMockChatForUsers } from "../mocks/mockChats";
import { getMockChatUsers } from "../mocks/mockChatUsers";
import { getMockChatDocuments } from "../mocks/mockDocuments";
import {
  getMockAuthorsForChat,
  getMockMessages,
  getMockThread,
  getMockThreads,
  markAllMockThreadsRead,
  markMockThreadRead,
  toggleMockReaction,
  toggleMockThreadReaction,
} from "../mocks/mockMessages";
import {
  GetChatMessagesParams,
  GetChatThreadParams,
  MarkChatThreadReadParams,
  ToggleChatReactionParams,
  ToggleChatThreadReactionParams,
  ChatUserFilters,
} from "../Driver";
import {
  Chat,
  ChatDocumentsPage,
  ChatMessage,
  ChatMessagesPage,
  ChatThread,
  ChatThreadDetail,
  ChatUser,
} from "../types";

import { StandardDriver } from "./StandardDriver";

const DEFAULT_CHAT_PAGE_SIZE = 50;
const MOCK_CHAT_LATENCY_MS = 250;

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Driver used while the chat backend does not exist yet. Inherits the real
 * endpoints implemented by `StandardDriver` (config, users) and stubs every
 * chat-related method with deterministic, faker-seeded mocks. Each method
 * holds the swap-point comment indicating which `fetchAPI` call it will be
 * replaced by — once the backend ships, fold each method back into
 * `StandardDriver` and delete this file.
 */
export class MockDriver extends StandardDriver {
  async getChatUsers(filters?: ChatUserFilters): Promise<ChatUser[]> {
    // MOCK — replace this block with `fetchAPI('chat-users/?q=…')` or the
    // eventual people-search endpoint. The driver contract
    // (query + exclusions → people shown in the composer search) is the swap
    // point for the New Chat UI.
    await delay(MOCK_CHAT_LATENCY_MS);

    return getMockChatUsers(filters);
  }

  async getChatForUsers(userIds: string[]): Promise<Chat | null> {
    // MOCK — replace this block with `fetchAPI('chats/resolve/', { params })`
    // when the backend can resolve an exact participant set. The driver
    // contract (participant ids → existing chat or null) lets the UI keep the
    // placeholder for genuinely new conversations.
    await delay(MOCK_CHAT_LATENCY_MS);

    return getMockChatForUsers(userIds);
  }

  async getChat(chatId: string): Promise<Chat> {
    // MOCK — replace this block with `fetchAPI('chats/:id/')` when the
    // backend exposes a single-chat endpoint. The driver contract
    // (chatId → Chat) is the swap point.
    await delay(MOCK_CHAT_LATENCY_MS);

    const chat = getMockChat(chatId);
    if (!chat) {
      throw new Error(`MockDriver.getChat: chat "${chatId}" not found.`);
    }
    return chat;
  }

  async getChatMessages({
    chatId,
    cursor,
    limit = DEFAULT_CHAT_PAGE_SIZE,
  }: GetChatMessagesParams): Promise<ChatMessagesPage> {
    // MOCK — replace this block with `fetchAPI('chats/:id/messages?…')`
    // when the backend exposes paginated history. The driver contract above
    // (cursor + limit → { messages, authors, nextCursor }) is the swap point.
    await delay(MOCK_CHAT_LATENCY_MS);

    const all = getMockMessages(chatId);
    const authors = getMockAuthorsForChat(chatId);

    let endIndex = all.length;
    if (cursor) {
      endIndex = all.findIndex((message) => message.id === cursor);
      if (endIndex < 0) {
        throw new Error(
          `MockDriver.getChatMessages: cursor "${cursor}" not found in chat "${chatId}".`,
        );
      }
    }
    const startIndex = Math.max(0, endIndex - limit);

    const messages = all.slice(startIndex, endIndex);
    const nextCursor = startIndex === 0 ? null : (messages[0]?.id ?? null);

    return { messages, authors, nextCursor };
  }

  async toggleChatReaction({
    chatId,
    messageId,
    emoji,
  }: ToggleChatReactionParams): Promise<ChatMessage> {
    // MOCK — replace this block with `fetchAPI('chats/:id/messages/:id/
    // reactions/', { method: 'POST' })` when the backend exposes reactions.
    // The driver contract (chatId + messageId + emoji → updated ChatMessage)
    // is the swap point.
    await delay(MOCK_CHAT_LATENCY_MS);

    const message = toggleMockReaction(chatId, messageId, emoji);
    if (!message) {
      throw new Error(
        `MockDriver.toggleChatReaction: message "${messageId}" not found in chat "${chatId}".`,
      );
    }
    return message;
  }

  async getChatDocuments(chatId: string): Promise<ChatDocumentsPage> {
    // MOCK — replace this block with `fetchAPI('chats/:id/documents/')`
    // when the backend exposes per-conversation documents. The driver contract
    // (chatId → { pinned, shared, multimedia }) is the swap point.
    if (!chatId) {
      throw new Error("MockDriver.getChatDocuments: chatId is required.");
    }
    await delay(MOCK_CHAT_LATENCY_MS);

    return getMockChatDocuments();
  }

  async getChatThreads(chatId: string): Promise<ChatThread[]> {
    // MOCK — replace this block with `fetchAPI('chats/:id/threads/')` when the
    // backend exposes per-conversation threads. The driver contract
    // (chatId → ChatThread[]) is the swap point.
    if (!chatId) {
      throw new Error("MockDriver.getChatThreads: chatId is required.");
    }
    await delay(MOCK_CHAT_LATENCY_MS);

    return getMockThreads(chatId);
  }

  async getChatThread({
    chatId,
    threadId,
  }: GetChatThreadParams): Promise<ChatThreadDetail> {
    // MOCK — replace this block with `fetchAPI('chats/:id/threads/:id/')` when
    // the backend exposes thread content. The driver contract
    // (chatId + threadId → ChatThreadDetail) is the swap point.
    await delay(MOCK_CHAT_LATENCY_MS);

    const detail = getMockThread(chatId, threadId);
    if (!detail) {
      throw new Error(
        `MockDriver.getChatThread: thread "${threadId}" not found in chat "${chatId}".`,
      );
    }
    return detail;
  }

  async toggleChatThreadReaction({
    chatId,
    threadId,
    messageId,
    emoji,
  }: ToggleChatThreadReactionParams): Promise<ChatMessage> {
    // MOCK — replace this block with `fetchAPI('chats/:id/threads/:id/
    // messages/:id/reactions/', { method: 'POST' })` when the backend exposes
    // thread reactions. The driver contract (chatId + threadId + messageId +
    // emoji → updated ChatMessage) is the swap point.
    await delay(MOCK_CHAT_LATENCY_MS);

    const message = toggleMockThreadReaction(
      chatId,
      threadId,
      messageId,
      emoji,
    );
    if (!message) {
      throw new Error(
        `MockDriver.toggleChatThreadReaction: message "${messageId}" not found in thread "${threadId}".`,
      );
    }
    return message;
  }

  async markChatThreadRead({
    chatId,
    threadId,
  }: MarkChatThreadReadParams): Promise<void> {
    // MOCK — replace this block with `fetchAPI('chats/:id/threads/:id/read/',
    // { method: 'POST' })` when the backend tracks read state. The driver
    // contract (chatId + threadId → void) is the swap point.
    await delay(MOCK_CHAT_LATENCY_MS);

    if (!markMockThreadRead(chatId, threadId)) {
      throw new Error(
        `MockDriver.markChatThreadRead: thread "${threadId}" not found in chat "${chatId}".`,
      );
    }
  }

  async markAllChatThreadsRead(chatId: string): Promise<void> {
    // MOCK — replace this block with `fetchAPI('chats/:id/threads/read/',
    // { method: 'POST' })` when the backend tracks read state. The driver
    // contract (chatId → void) is the swap point.
    if (!chatId) {
      throw new Error("MockDriver.markAllChatThreadsRead: chatId is required.");
    }
    await delay(MOCK_CHAT_LATENCY_MS);

    markAllMockThreadsRead(chatId);
  }
}
