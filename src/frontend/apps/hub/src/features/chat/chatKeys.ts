import type { AccountId, ChatRef } from "@/features/drivers/types";

export const chatKeys = {
  scopes: () => ["chat-scopes"] as const,
  accounts: (scopeId: string | null = null) =>
    ["chat-accounts", scopeId ?? "active"] as const,
  chatsAll: () => ["chats"] as const,
  chatsOf: (accountId: AccountId) => ["chats", accountId] as const,
  /** Per-account read-state slice (`chatId → ChatUnread`), decoupled from the
   * conversation-list and message caches so unread changes never refetch them. */
  unreadAll: () => ["chat-unread"] as const,
  unreadOf: (accountId: AccountId) => ["chat-unread", accountId] as const,
  noChat: () => ["chat", "none"] as const,

  chatForUsers: (
    accountId: AccountId | null,
    participantIds: readonly string[],
  ) => ["chat-for-users", accountId ?? "none", participantIds] as const,
  chat: (ref: ChatRef) => ["chat", ref.accountId, ref.chatId] as const,
  messages: (ref: ChatRef) =>
    ["chat-messages", ref.accountId, ref.chatId] as const,
  threads: (ref: ChatRef) =>
    ["chat-threads", ref.accountId, ref.chatId] as const,
  thread: (ref: ChatRef, threadId: string) =>
    ["chat-thread", ref.accountId, ref.chatId, threadId] as const,
  /** Prefix matching every thread detail of a chat (for bulk invalidation). */
  threadDetails: (ref: ChatRef) =>
    ["chat-thread", ref.accountId, ref.chatId] as const,
  documents: (ref: ChatRef) =>
    ["chat-documents", ref.accountId, ref.chatId] as const,
  connection: (
    accountId: AccountId,
    userId: string | null,
    driverInstanceId: number,
  ) => ["chat-connection", accountId, userId, driverInstanceId] as const,
};
