import { fetchAPI } from '@/features/api/fetchApi';
import {
  getMockAuthorsForChat,
  getMockMessages,
} from '@/features/chat/mockMessages';

import {
  Driver,
  GetChatMessagesParams,
  StoreType,
  UserFilters,
} from '../Driver';
import { ApiConfig, ChatDocumentsPage, ChatMessagesPage, User } from '../types';
import { MatrixClient } from 'matrix-js-sdk';
import { Store } from '../Store';
import { ChatListStore } from '@/features/matrix/stores/ChatListStore';
import { getMockChatDocuments } from '@/features/chat/components/tools-panel/mockDocuments';

const DEFAULT_CHAT_PAGE_SIZE = 50;
const MOCK_CHAT_LATENCY_MS = 250;

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class MatrixDriver extends Driver {
  private mx?: MatrixClient;
  private chatListStore?: ChatListStore;
  private isMatrixClientReady: boolean = false;
  private readinessListeners = new Set<() => void>();

  subscribeToReadiness(listener: () => void): () => void {
    this.readinessListeners.add(listener);
    return () => this.readinessListeners.delete(listener);
  }

  private notifyReadinessListeners() {
    this.readinessListeners.forEach((listener) => listener());
  }

  // Instance method to set the client when ready
  setMatrixClient(mx: MatrixClient) {
    console.log('***Setting matrix client in driver', mx);
    this.mx = mx;
    this.chatListStore = new ChatListStore();
    this.setClientReady(true);
  }

  setClientReady(isReady: boolean) {
    if (this.isMatrixClientReady === isReady) return; // Early return if no change
    console.log('*** MatrixDriver readiness changed:');
    this.isMatrixClientReady = isReady;
    this.notifyReadinessListeners();
  }

  getIsMatrixClientReady() {
    return this.isMatrixClientReady;
  }

  getStore<T>(type: StoreType): Store<T> | null {
    console.log('***in driver get store this.mx', this.mx);
    if (!this.mx) {
      return null;
    }
    console.log('***in driver get store type', type);
    switch (type) {
      case StoreType.ChatList:
        this.chatListStore?.setMatrixClient(this.mx);
        console.log('***in driver get store', this.chatListStore);
        return this.chatListStore as unknown as Store<T>;
      default:
        return null;
    }
  }

  // Helper to ensure mx is initialized
  private getClient(): MatrixClient {
    if (!this.mx) {
      throw new Error('MatrixClient not initialized');
    }
    return this.mx;
  }

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
      method: 'PATCH',
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
    const nextCursor = startIndex === 0 ? null : (messages[0]?.id ?? null);

    return { messages, authors, nextCursor };
  }

  getChats() {
    // const mx = this.getClient();
    // const rooms = mx.getVisibleRooms();
    // return rooms.map((room) => ({
    //   id: room.roomId,
    //   name: room.name || '',
    //   avatar: undefined,
    //   topic: room.topic,
    // }));
    return Promise.resolve(this.chatListStore!.getSnapshot());
    // return Promise.resolve(ALL_CHATS as [Chat]);
  }

  async getChatDocuments(chatId: string): Promise<ChatDocumentsPage> {
    // MOCK — replace this block with `fetchAPI('chats/:id/documents/')`
    // when the backend exposes per-conversation documents. The driver contract
    // (chatId → { pinned, shared, multimedia }) is the swap point.
    if (!chatId) {
      throw new Error('StandardDriver.getChatDocuments: chatId is required.');
    }
    await delay(MOCK_CHAT_LATENCY_MS);

    return getMockChatDocuments();
  }
}
