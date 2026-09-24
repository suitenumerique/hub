import type { ConversationSearchRequest } from "@/features/chat/search/types";
import { EMPTY_SECURITY, type ChatSecurityCommand } from "../security";

import {
  Driver as BaseDriver,
  type ChatConnectionState,
  type ChatEventListener,
  type ChatTypingListener,
  type ChatUserFilters,
  type DeleteChatMessageParams,
  type Driver,
  type EditChatMessageParams,
  type GetChatMessagesParams,
  type GetChatThreadParams,
  type MarkChatThreadReadParams,
  type RemoveChatFromHistoryResult,
  type SendChatMessageParams,
  type SendChatTypingParams,
  type SendChatThreadReplyParams,
  type StartChatThreadParams,
  type ToggleChatReactionParams,
  type ToggleChatThreadReactionParams,
} from "../Driver";
import type {
  AccountId,
  ChatMainTimelineUnread,
  ChatMessage,
  ChatMessagesPage,
  ChatMembers,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
  ChatUnread,
  ChatUser,
  LocalChat,
  LocalChatSections,
  User,
} from "../types";

import {
  clearStoredConversationSearch,
  MATRIX_USER_STORAGE_KEY,
  matrixStorageKey,
  matrixStorageOwner,
} from "./matrixStorage";

/**
 * Keeps `matrix-js-sdk` out of the main Next.js bundle. The real Matrix driver
 * is imported only when a Matrix account is active, then this class becomes a
 * thin proxy.
 */
export class LazyMatrixDriver extends BaseDriver {
  private readonly securityListeners = new Set<() => void>();
  private detachSecurity: () => void = () => {};
  // React's external-store snapshot must keep the same reference between
  // updates, including before the real driver has finished loading.
  private readonly initialSecurity = { ...EMPTY_SECURITY, supported: true };
  override getSecuritySnapshot = () =>
    this.target?.getSecuritySnapshot() ?? this.initialSecurity;
  override subscribeToSecurity = (listener: () => void): (() => void) => {
    this.securityListeners.add(listener);
    return () => {
      this.securityListeners.delete(listener);
    };
  };
  override securityCommand(command: ChatSecurityCommand): Promise<void> {
    return this.withTarget((driver) => driver.securityCommand(command));
  }
  private shutdownWork: Promise<void> | null = null;
  override readonly supportsConversationSearch = true;

  override searchConversations(request: ConversationSearchRequest) {
    return (
      this.target?.searchConversations(request) ??
      super.searchConversations(request)
    );
  }

  override getConversationSearchStatus() {
    return (
      this.target?.getConversationSearchStatus() ??
      super.getConversationSearchStatus()
    );
  }

  override retryConversationSearch(): void {
    this.target?.retryConversationSearch();
  }

  override async clearConversationSearch(): Promise<void> {
    if (this.target) await this.target.clearConversationSearch();
    else await clearStoredConversationSearch(this.accountId, this.storageOwner);
  }
  // Static capability the UI reads synchronously (see `useChatCompositionSupport`),
  // before the SDK lazy-loads. It must mirror the real `MatrixDriver`; the actual
  // `sendChatMessage` still routes through `withTarget`, loading the driver on demand.
  override readonly supportsComposition = true;
  override readonly supportsThreadComposition = true;
  override readonly supportsConversationHistoryRemoval = true;
  // Static capability mirroring the real `MatrixDriver`, read synchronously by
  // the New Chat composer before the SDK lazy-loads.
  override readonly supportsConversationCreation = true;

  private target: Driver | null = null;
  private targetPromise: Promise<Driver> | null = null;
  private readonly listeners = new Set<ChatEventListener>();
  private readonly unsubscriptions = new Map<ChatEventListener, () => void>();
  private readonly typingSubscriptions = new Set<{
    chatId: string;
    listener: ChatTypingListener;
    unsubscribe: () => void;
  }>();
  private disposed = false;
  private storageOwner: string | null;

  constructor(
    accountId: AccountId = "default",
    private readonly settings: Record<string, unknown> = {},
  ) {
    super(accountId);
    this.storageOwner = matrixStorageOwner(settings);
  }

  private async load(): Promise<Driver> {
    if (this.target) {
      return this.target;
    }
    if (!this.targetPromise) {
      this.targetPromise = import("./MatrixDriver").then(({ MatrixDriver }) => {
        const driver = new MatrixDriver(this.accountId, this.settings);
        if (this.disposed) {
          driver.destroy();
          return driver;
        }
        driver.initialize();
        this.listeners.forEach((listener) => {
          this.unsubscriptions.set(
            listener,
            driver.subscribeToEvents(listener),
          );
        });
        this.typingSubscriptions.forEach((subscription) => {
          subscription.unsubscribe = driver.subscribeToChatTyping(
            subscription.chatId,
            subscription.listener,
          );
        });
        this.target = driver;
        this.detachSecurity = driver.subscribeToSecurity(() =>
          this.securityListeners.forEach((listener) => listener()),
        );
        this.securityListeners.forEach((listener) => listener());
        return driver;
      });
    }
    return this.targetPromise;
  }

  private async withTarget<T>(run: (driver: Driver) => Promise<T>): Promise<T> {
    const driver = await this.load();
    if (this.disposed) throw new Error("Matrix driver has been destroyed.");
    return run(driver);
  }

  async getChats(): Promise<LocalChatSections> {
    return this.withTarget((driver) => driver.getChats());
  }

  async getChatUsers(filters?: ChatUserFilters): Promise<ChatUser[]> {
    return this.withTarget((driver) => driver.getChatUsers(filters));
  }

  async getChatMembers(chatId: string): Promise<ChatMembers> {
    return this.withTarget((driver) => driver.getChatMembers(chatId));
  }

  async getChatForUsers(userIds: string[]): Promise<LocalChat | null> {
    return this.withTarget((driver) => driver.getChatForUsers(userIds));
  }

  async createChatForUsers(userIds: string[]): Promise<LocalChat> {
    return this.withTarget((driver) => driver.createChatForUsers(userIds));
  }

  async acceptChatInvitation(chatId: string): Promise<LocalChat> {
    return this.withTarget((driver) => driver.acceptChatInvitation(chatId));
  }

  async refuseChatInvitation(chatId: string): Promise<void> {
    return this.withTarget((driver) => driver.refuseChatInvitation(chatId));
  }

  async getChat(chatId: string): Promise<LocalChat> {
    return this.withTarget((driver) => driver.getChat(chatId));
  }

  async getChatMessages(
    params: GetChatMessagesParams,
  ): Promise<ChatMessagesPage> {
    return this.withTarget((driver) => driver.getChatMessages(params));
  }

  async getMainTimelineUnread(chatId: string): Promise<ChatMainTimelineUnread> {
    return this.withTarget((driver) => driver.getMainTimelineUnread(chatId));
  }

  async toggleChatReaction(
    params: ToggleChatReactionParams,
  ): Promise<ChatMessage> {
    return this.withTarget((driver) => driver.toggleChatReaction(params));
  }

  async getChatThreads(chatId: string): Promise<ChatThread[]> {
    return this.withTarget((driver) => driver.getChatThreads(chatId));
  }

  async getChatThread(params: GetChatThreadParams): Promise<ChatThreadDetail> {
    return this.withTarget((driver) => driver.getChatThread(params));
  }

  async toggleChatThreadReaction(
    params: ToggleChatThreadReactionParams,
  ): Promise<ChatMessage> {
    return this.withTarget((driver) => driver.toggleChatThreadReaction(params));
  }

  async markChatThreadRead(params: MarkChatThreadReadParams): Promise<void> {
    return this.withTarget((driver) => driver.markChatThreadRead(params));
  }

  async markAllChatThreadsRead(chatId: string): Promise<void> {
    return this.withTarget((driver) => driver.markAllChatThreadsRead(chatId));
  }

  async markChatRead(chatId: string): Promise<void> {
    return this.withTarget((driver) => driver.markChatRead(chatId));
  }

  async markChatReadThrough(chatId: string, eventId: string): Promise<void> {
    return this.withTarget((driver) =>
      driver.markChatReadThrough(chatId, eventId),
    );
  }

  async getUnread(): Promise<Record<string, ChatUnread>> {
    return this.withTarget((driver) => driver.getUnread());
  }

  async setChatFavourite(chatId: string, favourite: boolean): Promise<void> {
    return this.withTarget((driver) =>
      driver.setChatFavourite(chatId, favourite),
    );
  }

  async removeChatFromHistory(
    chatId: string,
  ): Promise<RemoveChatFromHistoryResult> {
    return this.withTarget((driver) => driver.removeChatFromHistory(chatId));
  }

  async sendChatMessage(params: SendChatMessageParams): Promise<ChatMessage> {
    return this.withTarget((driver) => driver.sendChatMessage(params));
  }

  async editChatMessage(params: EditChatMessageParams): Promise<ChatMessage> {
    return this.withTarget((driver) => driver.editChatMessage(params));
  }

  async deleteChatMessage(
    params: DeleteChatMessageParams,
  ): Promise<ChatMessage> {
    return this.withTarget((driver) => driver.deleteChatMessage(params));
  }

  async sendChatTyping(params: SendChatTypingParams): Promise<void> {
    return this.withTarget((driver) => driver.sendChatTyping(params));
  }

  async sendChatThreadReply(
    params: SendChatThreadReplyParams,
  ): Promise<ChatThreadMutationResult> {
    return this.withTarget((driver) => driver.sendChatThreadReply(params));
  }

  async startChatThread(
    params: StartChatThreadParams,
  ): Promise<ChatThreadMutationResult> {
    return this.withTarget((driver) => driver.startChatThread(params));
  }

  async connect(user: User | null | undefined): Promise<ChatConnectionState> {
    // Logout must know the namespace even if the module import is still pending.
    this.storageOwner = matrixStorageOwner(this.settings, user);
    return this.withTarget((driver) => driver.connect(user));
  }

  override replaceLostDeviceSession(user: User): Promise<ChatConnectionState> {
    return this.withTarget((driver) => driver.replaceLostDeviceSession(user));
  }

  subscribeToEvents(listener: ChatEventListener): () => void {
    this.listeners.add(listener);
    if (this.target) {
      this.unsubscriptions.set(
        listener,
        this.target.subscribeToEvents(listener),
      );
    }
    return () => {
      this.listeners.delete(listener);
      this.unsubscriptions.get(listener)?.();
      this.unsubscriptions.delete(listener);
    };
  }

  subscribeToChatTyping(
    chatId: string,
    listener: ChatTypingListener,
  ): () => void {
    const subscription = {
      chatId,
      listener,
      unsubscribe: this.target
        ? this.target.subscribeToChatTyping(chatId, listener)
        : () => {},
    };
    this.typingSubscriptions.add(subscription);
    return () => {
      subscription.unsubscribe();
      this.typingSubscriptions.delete(subscription);
    };
  }

  destroy(): void {
    void this.shutdown();
  }

  override async logout(): Promise<void> {
    const driver = this.target;
    const loading = this.targetPromise;
    // Stop a pending import from starting a connection after logout begins.
    this.disposed = true;
    try {
      await (driver ?? (await loading))?.logout();
    } finally {
      try {
        await this.shutdown();
      } finally {
        // A never-connected or blocked target cannot clean its projection.
        // Once it has stopped, clean stored data only if no other tab owns it.
        if (navigator.locks) {
          const key = matrixStorageKey(
            this.accountId,
            MATRIX_USER_STORAGE_KEY,
            this.storageOwner,
          );
          await navigator.locks.request(
            `hub-matrix:session:${key}`,
            { mode: "exclusive", ifAvailable: true },
            async (lock) => {
              if (lock)
                await clearStoredConversationSearch(
                  this.accountId,
                  this.storageOwner,
                );
            },
          );
        }
      }
    }
  }

  override shutdown(): Promise<void> {
    if (this.shutdownWork) return this.shutdownWork;
    this.disposed = true;
    this.detachSecurity();
    this.securityListeners.clear();
    this.unsubscriptions.forEach((unsubscribe) => unsubscribe());
    this.unsubscriptions.clear();
    this.listeners.clear();
    this.typingSubscriptions.forEach(({ unsubscribe }) => unsubscribe());
    this.typingSubscriptions.clear();
    const target = this.target;
    const loading = this.targetPromise;
    target?.destroy();
    this.target = null;
    this.targetPromise = null;
    this.shutdownWork = (async () => {
      const driver = target ?? (await loading);
      await driver?.shutdown();
    })();
    return this.shutdownWork;
  }
}
