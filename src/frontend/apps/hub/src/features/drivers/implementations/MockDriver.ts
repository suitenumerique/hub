import {
  Driver,
  GetChatMessagesParams,
  GetChatThreadParams,
  MarkChatThreadReadParams,
  SendChatMessageParams,
  SendChatThreadReplyParams,
  StartChatThreadParams,
  ToggleChatReactionParams,
  ToggleChatThreadReactionParams,
  ChatUserFilters,
} from "../Driver";
import { MOCK_CHATS, type MockChat } from "../mocks/mockChats";
import { MOCK_CHAT_USERS, getMockChatUsers } from "../mocks/mockChatUsers";
import { getMockChatDocuments } from "../mocks/mockDocuments";
import {
  getMockAuthorsForChat,
  getMockMessages,
  getMockThread,
  getMockThreads,
  markAllMockThreadsRead,
  markMockThreadRead,
  sendMockMessage,
  sendMockThreadReply,
  startMockThread,
  toggleMockReaction,
  toggleMockThreadReaction,
} from "../mocks/mockMessages";
import {
  AccountId,
  ChatDocumentsPage,
  ChatMessage,
  ChatMessagesPage,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
  ChatUser,
  LocalChat,
  LocalChatSections,
} from "../types";

const DEFAULT_CHAT_PAGE_SIZE = 50;
const MOCK_CHAT_LATENCY_MS = 250;
const BASE_LAST_ACTIVITY = new Date("2026-05-12T18:00:00Z").getTime();

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type MockDriverSettings = {
  nameSuffix?: string;
  lastActivityOffsetMinutes?: number;
};

const readStringSetting = (
  settings: Record<string, unknown>,
  key: keyof MockDriverSettings,
): string | undefined =>
  typeof settings[key] === "string" ? settings[key] : undefined;

const readNumberSetting = (
  settings: Record<string, unknown>,
  key: keyof MockDriverSettings,
): number => (typeof settings[key] === "number" ? settings[key] : 0);

/**
 * Driver used while the chat backend does not exist yet. Inherits the real
 * chat contract with deterministic, faker-seeded mocks. Each method
 * holds the swap-point comment indicating which `fetchAPI` call it will be
 * replaced by — once the backend ships, fold each method back into
 * a real chat driver and delete this file.
 */
export class MockDriver extends Driver {
  override readonly supportsComposition: boolean = true;
  override readonly supportsConversationCreation: boolean = true;

  private readonly chats: LocalChat[];

  constructor(
    accountId: AccountId = "default",
    settings: Record<string, unknown> = {},
  ) {
    super(accountId);
    const nameSuffix = readStringSetting(settings, "nameSuffix");
    const offsetMinutes = readNumberSetting(
      settings,
      "lastActivityOffsetMinutes",
    );

    this.chats = MOCK_CHATS.map((chat, index) => ({
      ...chat,
      name: nameSuffix ? `${chat.name} (${nameSuffix})` : chat.name,
      lastActivityAt: new Date(
        BASE_LAST_ACTIVITY - (offsetMinutes + index * 7) * 60 * 1000,
      ).toISOString(),
    }));
  }

  async getChats(): Promise<LocalChatSections> {
    // MOCK — replace this block with `fetchAPI('chats/')` when the backend
    // exposes a conversation-list endpoint. The driver returns account-local
    // chats; hooks decorate them with the global account identity.

    await delay(MOCK_CHAT_LATENCY_MS);

    return {
      favourites: this.chats.filter((chat) => chat.section === "favourites"),
      all: this.chats.filter((chat) => chat.section === "all"),
    };
  }

  async getChatUsers(filters?: ChatUserFilters): Promise<ChatUser[]> {
    // MOCK — replace this block with `fetchAPI('chat-users/?q=…')` or the
    // eventual people-search endpoint. The driver contract
    // (query + exclusions → people shown in the composer search) is the swap
    // point for the New Chat UI.
    await delay(MOCK_CHAT_LATENCY_MS);

    return getMockChatUsers(filters);
  }

  async getChatForUsers(userIds: string[]): Promise<LocalChat | null> {
    // MOCK — replace this block with `fetchAPI('chats/resolve/', { params })`
    // when the backend can resolve an exact participant set. The driver
    // contract (participant ids → existing chat or null) lets the UI keep the
    // placeholder for genuinely new conversations. Resolves against the driver's
    // live list (seed + any conversation created this session) so a freshly
    // created conversation resolves on re-selection.
    await delay(MOCK_CHAT_LATENCY_MS);

    return this.findLocalChatForUsers(userIds) ?? null;
  }

  async createChatForUsers(userIds: string[]): Promise<LocalChat> {
    // MOCK — replace this block with `fetchAPI('chats/', { method: 'POST' })`
    // when the backend can create a conversation from a participant set. The
    // driver contract (participant ids → the new or existing LocalChat) is the
    // swap point for the New Chat "start a conversation" flow.
    await delay(MOCK_CHAT_LATENCY_MS);

    const participantIds = [...new Set(userIds)].sort();
    if (participantIds.length === 0) {
      throw new Error(
        "MockDriver.createChatForUsers: at least one participant is required.",
      );
    }
    // Idempotent: never duplicate a conversation that already exists.
    const existing = this.findLocalChatForUsers(participantIds);
    if (existing) {
      return existing;
    }

    const kind: LocalChat["kind"] =
      participantIds.length === 1 ? "direct" : "group";
    const chat: LocalChat = {
      id: `mock-chat-${participantIds.join("__")}`,
      name: this.composeChatName(participantIds),
      section: "all",
      lastActivityAt: new Date().toISOString(),
      kind,
      participantIds,
      visual:
        kind === "direct"
          ? { kind: "initials" }
          : { kind: "icon", icon: "groups" },
    };
    this.chats.unshift(chat);
    return chat;
  }

  async getChat(chatId: string): Promise<LocalChat> {
    // MOCK — replace this block with `fetchAPI('chats/:id/')` when the
    // backend exposes a single-chat endpoint. The driver contract
    // (chatId → LocalChat) is the swap point.
    await delay(MOCK_CHAT_LATENCY_MS);

    const chat = this.getLocalChat(chatId);
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

    const seedChat = this.getSeedChat(chatId);
    const all = getMockMessages(chatId, seedChat);
    const authors = getMockAuthorsForChat(chatId, seedChat);

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

  async sendChatMessage({
    chatId,
    content,
  }: SendChatMessageParams): Promise<ChatMessage> {
    // MOCK — replace this block with `fetchAPI('chats/:id/messages/',
    // { method: 'POST' })` when the backend exposes message composition.
    // The driver contract (chatId + content → ChatMessage) is the swap point.

    await delay(MOCK_CHAT_LATENCY_MS);

    const message = sendMockMessage(chatId, content, this.getSeedChat(chatId));
    if (!message) {
      throw new Error(
        `MockDriver.sendChatMessage: chat "${chatId}" not found.`,
      );
    }
    this.touchChat(chatId, message.timestamp);
    return message;
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

    const message = toggleMockReaction(
      chatId,
      messageId,
      emoji,
      this.getSeedChat(chatId),
    );
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

    return getMockThreads(chatId, this.getSeedChat(chatId));
  }

  async getChatThread({
    chatId,
    threadId,
  }: GetChatThreadParams): Promise<ChatThreadDetail> {
    // MOCK — replace this block with `fetchAPI('chats/:id/threads/:id/')` when
    // the backend exposes thread content. The driver contract
    // (chatId + threadId → ChatThreadDetail) is the swap point.
    await delay(MOCK_CHAT_LATENCY_MS);

    const detail = getMockThread(chatId, threadId, this.getSeedChat(chatId));
    if (!detail) {
      throw new Error(
        `MockDriver.getChatThread: thread "${threadId}" not found in chat "${chatId}".`,
      );
    }
    return detail;
  }

  async sendChatThreadReply({
    chatId,
    threadId,
    content,
  }: SendChatThreadReplyParams): Promise<ChatThreadMutationResult> {
    // MOCK — replace this block with `fetchAPI('chats/:id/threads/:id/
    // messages/', { method: 'POST' })` when the backend exposes thread replies.
    await delay(MOCK_CHAT_LATENCY_MS);

    const result = sendMockThreadReply(
      chatId,
      threadId,
      content,
      this.getSeedChat(chatId),
    );
    if (!result) {
      throw new Error(
        `MockDriver.sendChatThreadReply: thread "${threadId}" not found in chat "${chatId}".`,
      );
    }
    this.touchChat(chatId, result.message.timestamp);
    return result;
  }

  async startChatThread({
    chatId,
    rootMessageId,
    content,
  }: StartChatThreadParams): Promise<ChatThreadMutationResult> {
    // MOCK — replace this block with `fetchAPI('chats/:id/messages/:id/
    // thread/', { method: 'POST' })` when the backend exposes thread creation.
    await delay(MOCK_CHAT_LATENCY_MS);

    const result = startMockThread(
      chatId,
      rootMessageId,
      content,
      this.getSeedChat(chatId),
    );
    if (!result) {
      throw new Error(
        `MockDriver.startChatThread: message "${rootMessageId}" could not start a thread in chat "${chatId}".`,
      );
    }
    this.touchChat(chatId, result.message.timestamp);
    return result;
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
      this.getSeedChat(chatId),
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

    if (!markMockThreadRead(chatId, threadId, this.getSeedChat(chatId))) {
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

    markAllMockThreadsRead(chatId, this.getSeedChat(chatId));
  }

  private getLocalChat(chatId: string): LocalChat | undefined {
    return this.chats.find((chat) => chat.id === chatId);
  }

  /** The live conversation whose participant set matches, ignoring order/dupes. */
  private findLocalChatForUsers(userIds: string[]): LocalChat | undefined {
    const wanted = [...new Set(userIds)].sort().join(" ");
    return this.chats.find(
      (chat) => [...new Set(chat.participantIds)].sort().join(" ") === wanted,
    );
  }

  /** A readable conversation name from the mock people directory. */
  private composeChatName(participantIds: string[]): string {
    return participantIds
      .map((id) => MOCK_CHAT_USERS.find((user) => user.id === id)?.name ?? id)
      .join(", ");
  }

  private getSeedChat(chatId: string): MockChat | undefined {
    const chat = this.getLocalChat(chatId);
    if (!chat) {
      return undefined;
    }
    return {
      ...chat,
      id: `${this.accountId}:${chat.id}`,
    };
  }

  private touchChat(chatId: string, timestamp: string): void {
    const chat = this.getLocalChat(chatId);
    if (chat) {
      chat.lastActivityAt = timestamp;
      chat.unread = false;
    }
  }
}
