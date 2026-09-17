import type { AccountId, ChatRef } from "@/features/drivers/types";

export const chatKeys = {
  chatsAll: () => ["chats"] as const,
  /**
   * Without `spaceId`, returns the ACCOUNT-LEVEL prefix (`["chats", accountId]`),
   * on purpose: `useChats()` (no espace selected) queries with this bare key,
   * and every existing `invalidateQueries({ queryKey: chatKeys.chatsOf(accountId) })`
   * call (see `useChatEvents.ts`) relies on it matching every espace-scoped
   * variant too (react-query's default `invalidateQueries` match is a prefix
   * match) — do not pad the no-espace case with a sentinel value here.
   */
  chatsOf: (accountId: AccountId, spaceId?: string) =>
    spaceId
      ? (["chats", accountId, spaceId] as const)
      : (["chats", accountId] as const),
  unreadOf: (accountId: AccountId) => ["chat-unread", accountId] as const,
  spacesAll: () => ["spaces"] as const,
  spacesOf: (accountId: AccountId) => ["spaces", accountId] as const,
  noChat: () => ["chat", "none"] as const,

  /**
   * Existing conversation resolved from a participant set (New Chat search).
   * Keyed by the encryption asked for: a clear room and an encrypted one with
   * the same people are different conversations.
   */
  chatForUsers: (
    accountId: AccountId | null,
    participantIds: readonly string[],
    encrypted?: boolean,
  ) =>
    [
      "chat-for-users",
      accountId ?? "none",
      participantIds,
      encrypted ?? "any",
    ] as const,
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
  meetings: (ref: ChatRef) =>
    ["chat-meetings", ref.accountId, ref.chatId] as const,
  connection: (
    accountId: AccountId,
    userId: string | null,
    driverFingerprint?: string,
  ) => ["chat-connection", accountId, userId, driverFingerprint] as const,
  userPresences: (accountId: AccountId) =>
    ["chat-user-presence", accountId] as const,
  userPresence: (accountId: AccountId, userId: string) =>
    [...chatKeys.userPresences(accountId), userId] as const,
  selfPresencePreference: (accountId: AccountId) =>
    ["chat-self-presence-preference", accountId] as const,
  /** A `ChatVisual` image's driver-specific `url` resolved to a fetchable src. */
  avatarSrc: (accountId: AccountId, url: string) =>
    ["avatar-src", accountId, url] as const,
  /** The account's own avatar, as a driver-specific `ChatVisual.url` (not
   * yet resolved to a fetchable src — see `avatarSrc` for that). */
  myAvatarUrl: (accountId: AccountId) => ["my-avatar-url", accountId] as const,
};
