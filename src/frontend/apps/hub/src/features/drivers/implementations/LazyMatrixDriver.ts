import {
  Driver as BaseDriver,
  type ChatConnectionState,
  type ChatEventListener,
  type ChatUserFilters,
  type Driver,
  type GetChatMessagesParams,
  type GetChatThreadParams,
  type MarkChatThreadReadParams,
  type SendChatMessageParams,
  type SendChatThreadReplyParams,
  type StartChatThreadParams,
  type ToggleChatReactionParams,
  type ToggleChatThreadReactionParams,
} from "../Driver";
import type {
  AccountId,
  ChatDocumentsPage,
  ChatMessage,
  ChatMessagesPage,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
  ChatUnread,
  ChatUser,
  LocalChat,
  LocalChatSections,
  User,
} from "../types";

/**
 * Keeps `matrix-js-sdk` out of the main Next.js bundle. The real Matrix driver
 * is imported only when a Matrix account is active, then this class becomes a
 * thin proxy.
 */
export class LazyMatrixDriver extends BaseDriver {
  // Static capability the UI reads synchronously (see `useChatCompositionSupport`),
  // before the SDK lazy-loads. It must mirror the real `MatrixDriver`; the actual
  // `sendChatMessage` still routes through `withTarget`, loading the driver on demand.
  override readonly supportsComposition = true;
  override readonly supportsThreadComposition = true;
  // Static capability mirroring the real `MatrixDriver`, read synchronously by
  // the New Chat composer before the SDK lazy-loads.
  override readonly supportsConversationCreation = true;

  private target: Driver | null = null;
  private targetPromise: Promise<Driver> | null = null;
  private readonly listeners = new Set<ChatEventListener>();
  private readonly unsubscriptions = new Map<ChatEventListener, () => void>();
  private disposed = false;

  constructor(
    accountId: AccountId = "default",
    private readonly settings: Record<string, unknown> = {},
  ) {
    super(accountId);
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
        this.target = driver;
        return driver;
      });
    }
    return this.targetPromise;
  }

  private async withTarget<T>(run: (driver: Driver) => Promise<T>): Promise<T> {
    return run(await this.load());
  }

  async getChats(): Promise<LocalChatSections> {
    return this.withTarget((driver) => driver.getChats());
  }

  async getChatUsers(filters?: ChatUserFilters): Promise<ChatUser[]> {
    return this.withTarget((driver) => driver.getChatUsers(filters));
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

  async getChatDocuments(chatId: string): Promise<ChatDocumentsPage> {
    return this.withTarget((driver) => driver.getChatDocuments(chatId));
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

  async getUnread(): Promise<Record<string, ChatUnread>> {
    return this.withTarget((driver) => driver.getUnread());
  }

  async sendChatMessage(params: SendChatMessageParams): Promise<ChatMessage> {
    return this.withTarget((driver) => driver.sendChatMessage(params));
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
    return this.withTarget((driver) => driver.connect(user));
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

  destroy(): void {
    this.disposed = true;
    this.unsubscriptions.forEach((unsubscribe) => unsubscribe());
    this.unsubscriptions.clear();
    this.listeners.clear();
    this.target?.destroy();
    this.target = null;
    this.targetPromise = null;
  }
}
