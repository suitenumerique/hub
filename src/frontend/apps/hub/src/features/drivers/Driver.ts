import {
  ApiConfig,
  ChatDocumentsPage,
  ChatMessage,
  ChatMessagesPage,
  ChatThread,
  ChatThreadDetail,
  User,
} from "./types";

export type UserFilters = {
  q?: string;
};

export type GetChatMessagesParams = {
  chatId: string;
  /**
   * Cursor returned in `nextCursor` by the previous page. When provided, the
   * driver returns the page of messages immediately older than this cursor.
   * `null` or omitted means "fetch the latest page".
   */
  cursor?: string | null;
  /** Maximum number of messages to return. Drivers may clamp to a server cap. */
  limit?: number;
};

export type ToggleChatReactionParams = {
  chatId: string;
  messageId: string;
  /** Native emoji character to toggle for the current user. */
  emoji: string;
};

export type GetChatThreadParams = {
  chatId: string;
  threadId: string;
};

export type ToggleChatThreadReactionParams = {
  chatId: string;
  threadId: string;
  messageId: string;
  /** Native emoji character to toggle for the current user. */
  emoji: string;
};

export type MarkChatThreadReadParams = {
  chatId: string;
  threadId: string;
};

export abstract class Driver {
  abstract getConfig(): Promise<ApiConfig>;
  abstract getUsers(filters?: UserFilters): Promise<User[]>;
  abstract updateUser(payload: Partial<User> & { id: string }): Promise<User>;
  abstract getChatMessages(
    params: GetChatMessagesParams,
  ): Promise<ChatMessagesPage>;
  abstract getChatDocuments(chatId: string): Promise<ChatDocumentsPage>;
  /**
   * Toggles the current user's reaction with `emoji` on a message and resolves
   * with the updated message. Adding when absent, removing when already
   * present — see the `toggleReaction` helper in `features/chat/reactions`.
   */
  abstract toggleChatReaction(
    params: ToggleChatReactionParams,
  ): Promise<ChatMessage>;
  /** Threads opened from messages of the given conversation. */
  abstract getChatThreads(chatId: string): Promise<ChatThread[]>;
  /** Full content (root message + replies) of a single thread. */
  abstract getChatThread(
    params: GetChatThreadParams,
  ): Promise<ChatThreadDetail>;
  /** Toggles the current user's reaction on a message inside a thread. */
  abstract toggleChatThreadReaction(
    params: ToggleChatThreadReactionParams,
  ): Promise<ChatMessage>;
  /** Marks every reply of a thread as read for the current user. */
  abstract markChatThreadRead(params: MarkChatThreadReadParams): Promise<void>;
  /** Marks every thread of a conversation as read for the current user. */
  abstract markAllChatThreadsRead(chatId: string): Promise<void>;
}
