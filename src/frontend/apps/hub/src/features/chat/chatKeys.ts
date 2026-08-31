import type { AccountId, ChatRef } from "@/features/drivers/types";

const liveMessagesKey = (ref: ChatRef) =>
  ["chat-messages", ref.accountId, ref.chatId] as const;

const unreadMessagesKey = (ref: ChatRef) =>
  ["chat-unread-messages", ref.accountId, ref.chatId] as const;

export const chatKeys = {
  chatsAll: () => ["chats"] as const,
  chatsOf: (accountId: AccountId) => ["chats", accountId] as const,
  unreadOf: (accountId: AccountId) => ["chat-unread", accountId] as const,
  noChat: () => ["chat", "none"] as const,

  /** Existing conversation resolved from a participant set (New Chat search). */
  chatForUsers: (
    accountId: AccountId | null,
    participantIds: readonly string[],
  ) => ["chat-for-users", accountId ?? "none", participantIds] as const,
  /** Prefix matching every participant-set resolution of an account (for bulk
   * invalidation when the account's room list changes). */
  chatForUsersOf: (accountId: AccountId | null) =>
    ["chat-for-users", accountId ?? "none"] as const,
  chat: (ref: ChatRef) => ["chat", ref.accountId, ref.chatId] as const,
  messages: liveMessagesKey,
  /** Temporary bidirectional window opened around the first unread message. */
  unreadMessages: unreadMessagesKey,
  /** Every main-timeline cache, from permanent live end to temporary context. */
  messageWindows: (ref: ChatRef) =>
    [liveMessagesKey(ref), unreadMessagesKey(ref)] as const,
  threads: (ref: ChatRef) =>
    ["chat-threads", ref.accountId, ref.chatId] as const,
  thread: (ref: ChatRef, threadId: string) =>
    ["chat-thread", ref.accountId, ref.chatId, threadId] as const,
  threadDetails: (ref: ChatRef) =>
    ["chat-thread", ref.accountId, ref.chatId] as const,
  members: (ref: ChatRef) =>
    ["chat-members", ref.accountId, ref.chatId] as const,
  connection: (accountId: AccountId, userId: string | null) =>
    ["chat-connection", accountId, userId] as const,
};

export type ChatMessageWindowQueryKey = ReturnType<
  typeof chatKeys.messageWindows
>[number];
