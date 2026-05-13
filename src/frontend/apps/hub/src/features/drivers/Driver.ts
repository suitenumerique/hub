import { ApiConfig, ChatMessagesPage, User } from "./types";

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

export abstract class Driver {
  abstract getConfig(): Promise<ApiConfig>;
  abstract getUsers(filters?: UserFilters): Promise<User[]>;
  abstract updateUser(payload: Partial<User> & { id: string }): Promise<User>;
  abstract getChatMessages(
    params: GetChatMessagesParams,
  ): Promise<ChatMessagesPage>;
}
