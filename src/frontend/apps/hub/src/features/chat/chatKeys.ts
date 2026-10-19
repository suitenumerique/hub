import type {
  AccountId,
  ChatAttachment,
  ChatRef,
} from "@/features/drivers/types";

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
  messages: (ref: ChatRef) =>
    ["chat-messages", ref.accountId, ref.chatId] as const,
  mainTimelineUnread: (ref: ChatRef) =>
    ["chat-main-timeline-unread", ref.accountId, ref.chatId] as const,
  threads: (ref: ChatRef) =>
    ["chat-threads", ref.accountId, ref.chatId] as const,
  thread: (ref: ChatRef, threadId: string) =>
    ["chat-thread", ref.accountId, ref.chatId, threadId] as const,
  threadDetails: (ref: ChatRef) =>
    ["chat-thread", ref.accountId, ref.chatId] as const,
  members: (ref: ChatRef) =>
    ["chat-members", ref.accountId, ref.chatId] as const,
  /** Bytes of one attachment; the driver-owned source identifies the file. */
  attachment: (
    accountId: AccountId,
    attachment: ChatAttachment,
    variant: "original" | "preview",
  ) => ["chat-attachment", accountId, attachment.source, variant] as const,
  /** Image of a conversation avatar; the driver-owned URL identifies it. */
  avatar: (accountId: AccountId, avatarUrl: string) =>
    ["chat-avatar", accountId, avatarUrl] as const,
  connection: (accountId: AccountId, userId: string | null) =>
    ["chat-connection", accountId, userId] as const,
};
