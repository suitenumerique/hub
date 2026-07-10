import {
  AccountId,
  ChatDocumentsPage,
  ChatLocalUser,
  ChatMessage,
  ChatMessageAuthor,
  ChatMessagesPage,
  ChatReaction,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
  ChatUser,
  LocalChat,
  LocalChatSections,
  User,
} from "./types";

export type ChatUserFilters = {
  q?: string;
  excludeIds?: string[];
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

export type SendChatMessageParams = {
  chatId: string;
  content: string;
};

export type SendChatThreadReplyParams = {
  chatId: string;
  threadId: string;
  content: string;
};

export type StartChatThreadParams = {
  chatId: string;
  rootMessageId: string;
  content: string;
};

/**
 * Backend-agnostic connection lifecycle. The UI only ever observes this status;
 * *how* a connection is established (Matrix OIDC handshake, a backend session
 * cookie, nothing at all for mocks) is entirely the driver's concern.
 */
export type ChatConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export type ChatConnectionState = {
  status: ChatConnectionStatus;
  /** Credentials of the current user on the chat backend, when connected. */
  chatUser: ChatLocalUser | null;
  /** Optional redirect coordinated by the connection layer. */
  redirectTo?: string;
  error?: unknown;
};

/**
 * A backend-neutral real-time event, emitted by the driver's single global
 * stream (Matrix `/sync`, SSE, WebSocket…). The React Query bridge
 * (`useChatEvents`) decides, per event, whether to **patch** the cache directly
 * (fine-grained events that carry a payload) or **invalidate** it and let the
 * hook refetch (coarse events that only name what changed).
 *
 * The stream is GLOBAL, not per-conversation: a messaging app must react to
 * activity in conversations that are not currently open (unread badges, the
 * conversation list, invitations…). Events therefore always carry the `chatId`
 * (or none, for list-level changes) so the bridge can target the right cache.
 */
export type ChatEvent =
  // --- Fine-grained: carry enough data for a direct cache patch ----------
  | {
      type: "message:new";
      chatId: string;
      message: ChatMessage;
      /** Authors referenced by the message, to merge into the page cache. */
      authors?: ChatMessageAuthor[];
    }
  | { type: "message:updated"; chatId: string; message: ChatMessage }
  | {
      type: "reaction:updated";
      chatId: string;
      messageId: string;
      reactions: ChatReaction[];
      /** Set when the message lives inside a thread rather than the timeline. */
      threadId?: string;
    }
  // --- Coarse: only name what changed; the bridge invalidates & refetches -
  | { type: "chat:changed"; chatId: string }
  | { type: "threads:changed"; chatId: string }
  | { type: "documents:changed"; chatId: string }
  | { type: "chats:changed" };

export type ChatEventListener = (event: ChatEvent) => void;

export abstract class Driver {
  readonly accountId: AccountId;
  readonly supportsComposition: boolean = false;
  /**
   * Whether the driver can start a brand-new conversation from a participant set
   * (see `createChatForUsers`). Off by default so drivers opt in; gates the
   * New Chat composer for a not-yet-existing conversation.
   */
  readonly supportsConversationCreation: boolean = false;

  constructor(accountId: AccountId = "default") {
    this.accountId = accountId;
  }

  abstract getChats(): Promise<LocalChatSections>;
  /** People available when composing a new chat. */
  abstract getChatUsers(filters?: ChatUserFilters): Promise<ChatUser[]>;
  /** Existing conversation for exactly these participants, or `null`. */
  abstract getChatForUsers(userIds: string[]): Promise<LocalChat | null>;
  /** Single conversation, fetched by id. */
  abstract getChat(chatId: string): Promise<LocalChat>;
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

  // --- Composition --------------------------------------------------------
  // Unsupported by default so drivers can opt into composition incrementally.
  // MockDriver enables these methods; MatrixDriver intentionally does not in
  // the `chat-message-composition` change.

  async sendChatMessage(_params: SendChatMessageParams): Promise<ChatMessage> {
    void _params;
    throw new Error(
      `${this.constructor.name}.sendChatMessage: composition is not supported by this driver.`,
    );
  }

  async sendChatThreadReply(
    _params: SendChatThreadReplyParams,
  ): Promise<ChatThreadMutationResult> {
    void _params;
    throw new Error(
      `${this.constructor.name}.sendChatThreadReply: composition is not supported by this driver.`,
    );
  }

  async startChatThread(
    _params: StartChatThreadParams,
  ): Promise<ChatThreadMutationResult> {
    void _params;
    throw new Error(
      `${this.constructor.name}.startChatThread: composition is not supported by this driver.`,
    );
  }

  /**
   * Creates a brand-new conversation for exactly these participants (a direct
   * chat for one, a group for several) and resolves with it. Idempotent where it
   * can be: a driver that already has a conversation for the set SHOULD return it
   * rather than create a duplicate. Drives the New Chat "start a conversation"
   * flow — the UI creates the conversation lazily, on confirming the selection.
   * Unsupported by default so drivers opt in (see `supportsConversationCreation`).
   */
  async createChatForUsers(_userIds: string[]): Promise<LocalChat> {
    void _userIds;
    throw new Error(
      `${this.constructor.name}.createChatForUsers: creating a conversation is not supported by this driver.`,
    );
  }

  // --- Incoming invitations -----------------------------------------------
  // Unsupported by default so drivers opt into the invitation flow. The Matrix
  // driver implements both.

  /**
   * Accepts the pending incoming invitation for `chatId` and resolves with the
   * now-joined conversation, so the open route can switch from the invitation
   * detail view to the normal timeline. Unsupported by default.
   */
  async acceptChatInvitation(_chatId: string): Promise<LocalChat> {
    void _chatId;
    throw new Error(
      `${this.constructor.name}.acceptChatInvitation: invitations are not supported by this driver.`,
    );
  }

  /**
   * Refuses the pending incoming invitation for `chatId`, removing it from the
   * conversation list. Unsupported by default.
   */
  async refuseChatInvitation(_chatId: string): Promise<void> {
    void _chatId;
    throw new Error(
      `${this.constructor.name}.refuseChatInvitation: invitations are not supported by this driver.`,
    );
  }

  // --- Connection lifecycle (generic) -------------------------------------
  // Default implementations make a driver "connected" with no handshake, so
  // mock / cookie-based backends need not override them. Stateful backends
  // (Matrix…) override `connect` to drive an auth flow. Connection state is
  // owned by React Query (see `useChatConnection`), not a bespoke store.

  /** Run once when the driver becomes the active driver. Default: no-op. */
  initialize(): void {}

  /** Run on teardown (logout / unmount). Releases listeners, stops clients. */
  destroy(): void {}

  /**
   * Opens the chat-backend connection for the given Hub user (auth handshake,
   * client bootstrap…) and resolves with the resulting connection state. The
   * default makes the backend immediately usable with no handshake. The result
   * is cached/observed through React Query.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async connect(user: User | null | undefined): Promise<ChatConnectionState> {
    return { status: "connected", chatUser: null };
  }

  /**
   * Subscribes to the driver's SINGLE GLOBAL real-time event stream. The driver
   * invokes `listener` for every backend event across all conversations (new
   * messages anywhere, reactions, invitations, conversation-list changes…),
   * sourced from its transport (Matrix `/sync`, SSE, WebSocket…). The React
   * Query bridge (`useChatEvents`) then patches or invalidates the matching
   * cache. Mounted once for the whole messaging app, not per conversation.
   * Drivers without real-time support return a no-op. Returns an unsubscribe fn.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subscribeToEvents(listener: ChatEventListener): () => void {
    return () => {};
  }
}
