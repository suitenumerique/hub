import { fetchAPI } from "@/features/api/fetchApi";
import { getMockChatDocuments } from "@/features/chat/components/tools-panel/mockDocuments";
import {
  getMockAuthorsForChat,
  getMockMessages,
  toggleMockReaction,
} from "@/features/chat/mockMessages";

import {
  Driver,
  GetChatMessagesParams,
  ToggleChatReactionParams,
  UserFilters,
} from "../Driver";
import {
  ApiConfig,
  ChatDocumentsPage,
  ChatMessage,
  ChatMessagesPage,
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
}
