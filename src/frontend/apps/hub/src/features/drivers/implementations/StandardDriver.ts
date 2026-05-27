import { fetchAPI } from "@/features/api/fetchApi";
import { getMockChatDocuments } from "@/features/chat/components/tools-panel/mockDocuments";
import {
  getMockAuthorsForChat,
  getMockMessages,
  getMockThread,
  getMockThreads,
  markAllMockThreadsRead,
  markMockThreadRead,
  toggleMockReaction,
  toggleMockThreadReaction,
} from "@/features/chat/mockMessages";

import {
  Driver,
  GetChatMessagesParams,
  GetChatThreadParams,
  MarkChatThreadReadParams,
  ToggleChatReactionParams,
  ToggleChatThreadReactionParams,
  UserFilters,
} from "../Driver";
import {
  ApiConfig,
  ChatDocumentsPage,
  ChatMessage,
  ChatMessagesPage,
  ChatThread,
  ChatThreadDetail,
  User,
} from "../types";

const DEFAULT_CHAT_PAGE_SIZE = 50;
const MOCK_CHAT_LATENCY_MS = 250;

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class StandardDriver extends Driver {
  async getConfig(): Promise<ApiConfig> {
    const response = await fetchAPI(`config/`);
    const data = await response.json();
    return data;
  }

  async getUsers(filters?: UserFilters): Promise<User[]> {
    const response = await fetchAPI(`users/`, {
      params: filters,
    });
    const data = await response.json();
    return data;
  }

  async updateUser(payload: Partial<User> & { id: string }): Promise<User> {
    const response = await fetchAPI(`users/${payload.id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return data;
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
          `StandardDriver.getChatMessages: cursor "${cursor}" not found in chat "${chatId}".`,
        );
      }
    }
    const startIndex = Math.max(0, endIndex - limit);

    const messages = all.slice(startIndex, endIndex);
    const nextCursor = startIndex === 0 ? null : messages[0]?.id ?? null;

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
        `StandardDriver.toggleChatReaction: message "${messageId}" not found in chat "${chatId}".`,
      );
    }
    return message;
  }

  async getChatDocuments(chatId: string): Promise<ChatDocumentsPage> {
    // MOCK — replace this block with `fetchAPI('chats/:id/documents/')`
    // when the backend exposes per-conversation documents. The driver contract
    // (chatId → { pinned, shared, multimedia }) is the swap point.
    if (!chatId) {
      throw new Error("StandardDriver.getChatDocuments: chatId is required.");
    }
    await delay(MOCK_CHAT_LATENCY_MS);

    return getMockChatDocuments();
  }

  async getChatThreads(chatId: string): Promise<ChatThread[]> {
    // MOCK — replace this block with `fetchAPI('chats/:id/threads/')` when the
    // backend exposes per-conversation threads. The driver contract
    // (chatId → ChatThread[]) is the swap point.
    if (!chatId) {
      throw new Error("StandardDriver.getChatThreads: chatId is required.");
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
        `StandardDriver.getChatThread: thread "${threadId}" not found in chat "${chatId}".`,
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
        `StandardDriver.toggleChatThreadReaction: message "${messageId}" not found in thread "${threadId}".`,
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
        `StandardDriver.markChatThreadRead: thread "${threadId}" not found in chat "${chatId}".`,
      );
    }
  }

  async markAllChatThreadsRead(chatId: string): Promise<void> {
    // MOCK — replace this block with `fetchAPI('chats/:id/threads/read/',
    // { method: 'POST' })` when the backend tracks read state. The driver
    // contract (chatId → void) is the swap point.
    if (!chatId) {
      throw new Error(
        "StandardDriver.markAllChatThreadsRead: chatId is required.",
      );
    }
    await delay(MOCK_CHAT_LATENCY_MS);

    markAllMockThreadsRead(chatId);
  }
}
