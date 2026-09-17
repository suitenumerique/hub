import type {
  ConversationSearchRequest,
  MessageSearchRequest,
} from "@/features/chat/search/types";

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
  ChatMeeting,
  ChatMessage,
  ChatMessagesPage,
  ChatMembers,
  ChatSelfPresencePreference,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
  ChatUnread,
  ChatUser,
  ChatUserPresence,
  LocalChat,
  LocalChatSections,
  LocalSpace,
  MeetRoom,
  StartMeetingOptions,
  User,
} from "../types";

import {
  clearStoredConversationSearch,
  matrixStorageOwner,
} from "./matrixStorage";
import { readChatSelfPresencePreference } from "../presencePreference";

/**
 * Keeps `matrix-js-sdk` out of the main Next.js bundle. The real Matrix driver
 * is imported only when a Matrix account is active, then this class becomes a
 * thin proxy.
 */
export class LazyMatrixDriver extends BaseDriver {
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

  override readonly supportsMessageSearch = true;

  override searchMessages(request: MessageSearchRequest) {
    return (
      this.target?.searchMessages(request) ?? super.searchMessages(request)
    );
  }

  override getMessageSearchStatus() {
    return (
      this.target?.getMessageSearchStatus() ?? super.getMessageSearchStatus()
    );
  }

  override retryMessageSearch(): void {
    this.target?.retryMessageSearch();
  }

  override async clearMessageSearch(): Promise<void> {
    if (this.target) await this.target.clearMessageSearch();
  }

  override backfillMessageSearchRoom(roomId: string): void {
    this.target?.backfillMessageSearchRoom(roomId);
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
  override readonly supportsSpaces = true;
  override readonly supportsSpaceCreation = true;
  // Static capability mirroring the real `MatrixDriver`, read by the meeting
  // button before the SDK lazy-loads.
  override readonly supportsMeetings = true;

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

  async getChats(spaceId?: string): Promise<LocalChatSections> {
    return this.withTarget((driver) => driver.getChats(spaceId));
  }

  async getSpaces(): Promise<LocalSpace[]> {
    return this.withTarget((driver) => driver.getSpaces());
  }

  async createSpace(name: string): Promise<LocalSpace> {
    return this.withTarget((driver) => driver.createSpace(name));
  }

  async getChatUsers(filters?: ChatUserFilters): Promise<ChatUser[]> {
    return this.withTarget((driver) => driver.getChatUsers(filters));
  }

  getUserPresence(userId: string): ChatUserPresence | null {
    return this.target?.getUserPresence(userId) ?? null;
  }

  override readonly supportsPresence = true;

  getCurrentUserId(): string | null {
    return this.target?.getCurrentUserId() ?? null;
  }

  getSelfPresencePreference(): ChatSelfPresencePreference {
    return (
      this.target?.getSelfPresencePreference() ??
      readChatSelfPresencePreference(this.accountId)
    );
  }

  async setSelfPresencePreference(
    preference: ChatSelfPresencePreference,
  ): Promise<void> {
    return this.withTarget((driver) =>
      driver.setSelfPresencePreference(preference),
    );
  }

  async setUserPresence(state: ChatUserPresence["state"]): Promise<void> {
    return this.withTarget((driver) => driver.setUserPresence(state));
  }

  async getChatMembers(chatId: string): Promise<ChatMembers> {
    return this.withTarget((driver) => driver.getChatMembers(chatId));
  }

  async getChatForUsers(userIds: string[]): Promise<LocalChat | null> {
    return this.withTarget((driver) => driver.getChatForUsers(userIds));
  }

  async createChatForUsers(
    userIds: string[],
    name?: string,
    spaceId?: string,
    forceNew?: boolean,
  ): Promise<LocalChat> {
    return this.withTarget((driver) =>
      driver.createChatForUsers(userIds, name, spaceId, forceNew),
    );
  }

  // Static capability mirroring the real `MatrixDriver`, read synchronously
  // before the SDK lazy-loads.
  override readonly supportsAvatarUpload = true;

  async setUserAvatar(file: File): Promise<string> {
    return this.withTarget((driver) => driver.setUserAvatar(file));
  }

  async setChatAvatar(chatId: string, file: File): Promise<string> {
    return this.withTarget((driver) => driver.setChatAvatar(chatId, file));
  }

  async resolveAvatarUrl(url: string): Promise<string> {
    return this.withTarget((driver) => driver.resolveAvatarUrl(url));
  }

  async getUserAvatarUrl(): Promise<string | undefined> {
    return this.withTarget((driver) => driver.getUserAvatarUrl());
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

  override async getChatMeetings(chatId: string): Promise<ChatMeeting[]> {
    return this.withTarget((driver) => driver.getChatMeetings(chatId));
  }

  override async startChatMeeting(
    chatId: string,
    createRoom: () => Promise<MeetRoom>,
    options?: StartMeetingOptions,
  ): Promise<ChatMeeting> {
    return this.withTarget((driver) =>
      driver.startChatMeeting(chatId, createRoom, options),
    );
  }

  override async endChatMeeting(
    chatId: string,
    meetingId: string,
  ): Promise<void> {
    return this.withTarget((driver) =>
      driver.endChatMeeting(chatId, meetingId),
    );
  }

  override async renameChatMeeting(
    chatId: string,
    meetingId: string,
    title: string,
  ): Promise<void> {
    return this.withTarget((driver) =>
      driver.renameChatMeeting(chatId, meetingId, title),
    );
  }

  override async extendChatMeeting(
    chatId: string,
    meetingId: string,
    minutes: number,
  ): Promise<void> {
    return this.withTarget((driver) =>
      driver.extendChatMeeting(chatId, meetingId, minutes),
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
    this.disposed = true;
    this.unsubscriptions.forEach((unsubscribe) => unsubscribe());
    this.unsubscriptions.clear();
    this.listeners.clear();
    this.typingSubscriptions.forEach(({ unsubscribe }) => unsubscribe());
    this.typingSubscriptions.clear();
    this.target?.destroy();
    this.target = null;
    this.targetPromise = null;
  }
}
