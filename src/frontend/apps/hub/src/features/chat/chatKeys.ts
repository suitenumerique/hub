import type { AccountId, ChatRef } from "@/features/drivers/types";

export const chatKeys = {
  scopes: () => ["chat-scopes"] as const,
  accounts: (scopeId: string | null = null) =>
    ["chat-accounts", scopeId ?? "active"] as const,
  chatsAll: () => ["chats"] as const,
  chatsOf: (accountId: AccountId) => ["chats", accountId] as const,
  noChat: () => ["chat", "none"] as const,

  chat: (ref: ChatRef) => ["chat", ref.accountId, ref.chatId] as const,
  messages: (ref: ChatRef) =>
    ["chat-messages", ref.accountId, ref.chatId] as const,
  threads: (ref: ChatRef) =>
    ["chat-threads", ref.accountId, ref.chatId] as const,
  thread: (ref: ChatRef, threadId: string) =>
    ["chat-thread", ref.accountId, ref.chatId, threadId] as const,
  documents: (ref: ChatRef) =>
    ["chat-documents", ref.accountId, ref.chatId] as const,
  connection: (accountId: AccountId, userId: string | null) =>
    ["chat-connection", accountId, userId] as const,
};
