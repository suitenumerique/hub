import { fetchAPI } from '@/features/api/fetchApi';

import {
  Driver,
  GetChatMessagesParams,
  StoreType,
  UserFilters,
} from '../Driver';
import {
  ApiConfig,
  Chat,
  ChatDocumentsPage,
  ChatMessagesPage,
  User,
} from '../types';
import { MatrixClient } from 'matrix-js-sdk';
import { Store } from '../Store';
import { ChatListStore } from '@/features/matrix/stores/ChatListStore';
import { getMockChatDocuments } from '@/features/chat/components/tools-panel/mockDocuments';
import { ChatTimelineStore } from '@/features/matrix/stores/ChatTimelineStore';
import { matrixRoomToHub } from '@/features/matrix/utils/types/matrixTypesToHub';

const DEFAULT_CHAT_PAGE_SIZE = 50;
const MOCK_CHAT_LATENCY_MS = 250;

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class MatrixDriver extends Driver {
  private mx?: MatrixClient;
  private chatListStore?: ChatListStore;
  private chatTimelineStore?: ChatTimelineStore;
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
    this.chatTimelineStore = new ChatTimelineStore(null);
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
        console.log('***in driver get store chatListStore', this.chatListStore);
        return this.chatListStore as unknown as Store<T>;
      case StoreType.Chattimeline:
        this.chatTimelineStore?.setMatrixClient(this.mx);
        console.log(
          '***in driver get store chatTimelineStore',
          this.chatTimelineStore,
        );
        return this.chatTimelineStore as unknown as Store<T>;
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
    return { messages, authors, nextCursor };
  }

  getChats() {
    return Promise.resolve(this.chatListStore!.getSnapshot());
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

  // Get a specific chat with his id
  getChat(chatId: string): Chat | null {
    if (!this.mx) {
      return null;
    }
    const matrixRoom = this.mx!.getRoom(chatId);
    return matrixRoomToHub(matrixRoom!);
  }
}
