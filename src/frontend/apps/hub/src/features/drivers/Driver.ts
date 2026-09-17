import {
  EMPTY_SEARCH_STATUS,
  EMPTY_MESSAGE_SEARCH_STATUS,
  type ConversationSearchRequest,
  type ConversationSearchPage,
  type ConversationSearchStatus,
  type MessageSearchRequest,
  type MessageSearchPage,
  type MessageSearchStatus,
} from "@/features/chat/search/types";

import {
  AccountId,
  ChatLocalUser,
  ChatMainTimelineUnread,
  ChatMeeting,
  ChatMessage,
  ChatMessageAuthor,
  ChatMessagesPage,
  ChatMembers,
  ChatReaction,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
  ChatTypingUser,
  ChatUnread,
  ChatUser,
  ChatUserPresence,
  ChatSelfPresencePreference,
  LocalChat,
  LocalChatSections,
  LocalSpace,
  MeetRoom,
  StartMeetingOptions,
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
  /** Resolve a fresh contextual window around this stable Matrix event id. */
  anchorId?: string;
  /** Direction used when continuing a contextual window from `cursor`. */
  direction?: "older" | "newer";
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

export type EditChatMessageParams = {
  chatId: string;
  messageId: string;
  content: string;
  /** Present when the edited message belongs to a Matrix thread. */
  threadId?: string;
};

export type DeleteChatMessageParams = {
  chatId: string;
  messageId: string;
  /** Present when the redacted message belongs to a Matrix thread. */
  threadId?: string;
};

/**
 * Removing a conversation is not atomic on every backend: Matrix must first
 * leave the room, then forget it. A failed second step is retryable even though
 * the user is already no longer a member.
 */
export type RemoveChatFromHistoryResult =
  | { status: "forgotten" }
  | { status: "left_only"; cause: unknown };

export type SendChatTypingParams = {
  chatId: string;
  isTyping: boolean;
};

export type ChatTypingListener = (users: ChatTypingUser[]) => void;

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
 * cookie, or another protocol) is entirely the driver's concern.
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
  | { type: "search:changed" }
  | { type: "user:presence-changed"; presence: ChatUserPresence }
  // Delivery signals are independent from timeline/cache patches.
  | {
      type: "message:received";
      chatId: string;
      chatName: string;
      content: string;
    }
  | {
      type: "invitation:received";
      chatId: string;
      chatName: string;
      inviterName?: string;
    }
  // --- Fine-grained: carry enough data for a direct cache patch ----------
  | {
      type: "message:new";
      chatId: string;
      message: ChatMessage;
      /** Authors referenced by the message, to merge into the page cache. */
      authors?: ChatMessageAuthor[];
    }
  | {
      type: "message:updated";
      chatId: string;
      message: ChatMessage;
      /** Set when the updated message is also rendered in thread detail. */
      threadId?: string;
    }
  | {
      type: "reaction:updated";
      chatId: string;
      messageId: string;
      reactions: ChatReaction[];
      /** Set when the message lives inside a thread rather than the timeline. */
      threadId?: string;
    }
  | { type: "unread:changed"; chatId: string; unread: ChatUnread }
  | { type: "main-timeline-unread:changed"; chatId: string }
  // --- Coarse: only name what changed; the bridge invalidates & refetches -
  | { type: "chat:changed"; chatId: string }
  | {
      type: "threads:changed";
      chatId: string;
      /** False when a preceding fine-grained event already patched the open
       * detail and only the thread list metadata needs a refresh. */
      invalidateDetails?: boolean;
    }
  | { type: "members:changed"; chatId: string }
  | { type: "tags:changed"; chatId: string }
  | { type: "chats:changed" }
  | { type: "meeting:changed"; chatId: string };

export type ChatEventListener = (event: ChatEvent) => void;

export abstract class Driver {
  readonly accountId: AccountId;
  readonly supportsConversationSearch: boolean = false;

  /** Local-only reads. Connection and preparation belong to the lifecycle. */
  async searchConversations(
    _request: ConversationSearchRequest,
  ): Promise<ConversationSearchPage> {
    void _request;
    return {
      results: [],
      total: 0,
    };
  }

  getConversationSearchStatus(): ConversationSearchStatus {
    return EMPTY_SEARCH_STATUS;
  }

  retryConversationSearch(): void {}

  /** Explicit Hub logout erases search; an ordinary destroy preserves it. */
  async clearConversationSearch(): Promise<void> {}

  readonly supportsMessageSearch: boolean = false;

  /** Search message content with optional filters. */
  async searchMessages(
    _request: MessageSearchRequest,
  ): Promise<MessageSearchPage> {
    void _request;
    return {
      results: [],
      total: 0,
    };
  }

  getMessageSearchStatus(): MessageSearchStatus {
    return EMPTY_MESSAGE_SEARCH_STATUS;
  }

  retryMessageSearch(): void {}

  /** Plaintext-at-rest: erased at explicit Hub logout, same as clearConversationSearch. */
  async clearMessageSearch(): Promise<void> {}

  /** Fetches older history for one room, bounded, so it becomes searchable. */
  backfillMessageSearchRoom(_roomId: string): void {
    void _roomId;
  }

  readonly supportsComposition: boolean = false;
  readonly supportsThreadComposition: boolean = false;
  /** Whether the driver can leave and forget a conversation for this account. */
  readonly supportsConversationHistoryRemoval: boolean = false;
  /**
   * Whether the driver can start a brand-new conversation from a participant set
   * (see `createChatForUsers`). Off by default so drivers opt in; gates the
   * New Chat composer for a not-yet-existing conversation.
   */
  readonly supportsConversationCreation: boolean = false;
  /** Whether the driver exposes a Matrix-Space-like grouping (`getSpaces`). */
  readonly supportsSpaces: boolean = false;
  /** Whether the driver can create a new espace (see `createSpace`). */
  readonly supportsSpaceCreation: boolean = false;
  /** Whether the driver can start/list meetings for a conversation. */
  readonly supportsMeetings: boolean = false;

  constructor(accountId: AccountId = "default") {
    this.accountId = accountId;
  }

  /** All conversations, optionally scoped to one espace (`spaceId`). */
  abstract getChats(spaceId?: string): Promise<LocalChatSections>;
  /**
   * Espaces (Matrix Spaces) the current user belongs to. Unsupported by
   * default; see `supportsSpaces`.
   */
  async getSpaces(): Promise<LocalSpace[]> {
    return [];
  }
  /**
   * Creates a new espace and resolves with it. Unsupported by default so
   * drivers opt in (see `supportsSpaceCreation`).
   */
  async createSpace(_name: string): Promise<LocalSpace> {
    void _name;
    throw new Error(
      `${this.constructor.name}.createSpace: creating an espace is not supported by this driver.`,
    );
  }
  /** People available when composing a new chat. */
  abstract getChatUsers(filters?: ChatUserFilters): Promise<ChatUser[]>;
  /**
   * Current presence already known by the backend client, without requesting it
   * from the network. Live changes arrive through `subscribeToEvents`.
   */
  getUserPresence(_userId: string): ChatUserPresence | null {
    void _userId;
    return null;
  }
  /** Whether this backend lets the current user publish presence. */
  readonly supportsPresence: boolean = false;
  /** Current backend user id, when the account has an active connection. */
  getCurrentUserId(): string | null {
    return null;
  }
  /** Persisted manual mode for this client (`online` means automatic). */
  getSelfPresencePreference(): ChatSelfPresencePreference {
    return "online";
  }
  /** Persists and applies the manual mode for this client. */
  async setSelfPresencePreference(
    _preference: ChatSelfPresencePreference,
  ): Promise<void> {
    void _preference;
    throw new Error(
      `${this.constructor.name}.setSelfPresencePreference: presence is not supported by this driver.`,
    );
  }
  /** Publishes an effective transport state; automatic transitions use this. */
  async setUserPresence(_state: ChatUserPresence["state"]): Promise<void> {
    void _state;
    throw new Error(
      `${this.constructor.name}.setUserPresence: presence is not supported by this driver.`,
    );
  }
  /** Joined members and pending invitees of one conversation. */
  abstract getChatMembers(chatId: string): Promise<ChatMembers>;
  /** Existing conversation for exactly these participants, or `null`. */
  abstract getChatForUsers(userIds: string[]): Promise<LocalChat | null>;
  /** Single conversation, fetched by id. */
  abstract getChat(chatId: string): Promise<LocalChat>;
  abstract getChatMessages(
    params: GetChatMessagesParams,
  ): Promise<ChatMessagesPage>;
  /** Exact main-timeline boundary/count and the first unread event identity. */
  abstract getMainTimelineUnread(
    chatId: string,
  ): Promise<ChatMainTimelineUnread>;
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
  /** Marks the main timeline read once it is genuinely visible to the user. */
  abstract markChatRead(chatId: string): Promise<void>;
  /** Advances the main boundary through one genuinely visible Matrix event. */
  abstract markChatReadThrough(chatId: string, eventId: string): Promise<void>;
  /** Initial per-conversation read state; live changes use `unread:changed`. */
  abstract getUnread(): Promise<Record<string, ChatUnread>>;

  /** Sets the current user's favourite tag for one conversation. */
  abstract setChatFavourite(chatId: string, favourite: boolean): Promise<void>;

  /**
   * Meetings held in this conversation, newest first. Unsupported drivers
   * resolve with an empty list so the meeting history UI can render an
   * empty state without branching on driver capability.
   */
  async getChatMeetings(_chatId: string): Promise<ChatMeeting[]> {
    void _chatId;
    return [];
  }

  /**
   * Starts a meeting now, or schedules one when `options.startsAt` is in the
   * future. Starting now returns the meeting already ongoing, if any, so a
   * second click (from this user or another member) joins the same call
   * instead of creating a duplicate room. `createRoom` is only called when a
   * new call is needed. Unsupported by default so drivers opt in (see
   * `supportsMeetings`).
   */
  async startChatMeeting(
    _chatId: string,
    _createRoom: () => Promise<MeetRoom>,
    _options?: StartMeetingOptions,
  ): Promise<ChatMeeting> {
    void _chatId;
    void _createRoom;
    void _options;
    throw new Error(
      `${this.constructor.name}.startChatMeeting: meetings are not supported by this driver.`,
    );
  }

  /** Closes a meeting for every member. Only its organizer may do it. */
  async endChatMeeting(_chatId: string, _meetingId: string): Promise<void> {
    void _chatId;
    void _meetingId;
    throw new Error(
      `${this.constructor.name}.endChatMeeting: meetings are not supported by this driver.`,
    );
  }

  /** Renames a meeting; an empty title removes it. Only its organizer may do it. */
  async renameChatMeeting(
    _chatId: string,
    _meetingId: string,
    _title: string,
  ): Promise<void> {
    void _chatId;
    void _meetingId;
    void _title;
    throw new Error(
      `${this.constructor.name}.renameChatMeeting: meetings are not supported by this driver.`,
    );
  }

  /** Adds time to a meeting's planned duration. Only its organizer may do it. */
  async extendChatMeeting(
    _chatId: string,
    _meetingId: string,
    _minutes: number,
  ): Promise<void> {
    void _chatId;
    void _meetingId;
    void _minutes;
    throw new Error(
      `${this.constructor.name}.extendChatMeeting: meetings are not supported by this driver.`,
    );
  }

  /**
   * Leaves a conversation and removes its history from the current account.
   * Unsupported by default so account drivers opt into the destructive flow.
   */
  async removeChatFromHistory(
    _chatId: string,
  ): Promise<RemoveChatFromHistoryResult> {
    void _chatId;
    throw new Error(
      `${this.constructor.name}.removeChatFromHistory: conversation history removal is not supported by this driver.`,
    );
  }

  // --- Composition --------------------------------------------------------
  // Unsupported by default so drivers can opt into composition incrementally.
  // Implementations advertise each supported surface through capability flags.

  async sendChatMessage(_params: SendChatMessageParams): Promise<ChatMessage> {
    void _params;
    throw new Error(
      `${this.constructor.name}.sendChatMessage: composition is not supported by this driver.`,
    );
  }

  async editChatMessage(_params: EditChatMessageParams): Promise<ChatMessage> {
    void _params;
    throw new Error(
      `${this.constructor.name}.editChatMessage: message editing is not supported by this driver.`,
    );
  }

  async deleteChatMessage(
    _params: DeleteChatMessageParams,
  ): Promise<ChatMessage> {
    void _params;
    throw new Error(
      `${this.constructor.name}.deleteChatMessage: message deletion is not supported by this driver.`,
    );
  }

  /** Sends a volatile typing state. Unsupported drivers silently ignore it. */
  async sendChatTyping(_params: SendChatTypingParams): Promise<void> {
    void _params;
  }

  /**
   * Subscribes to the current typers of one conversation. This deliberately
   * stays outside React Query: typing is ephemeral and must never enter an
   * infinite timeline cache or survive a page reload.
   */
  subscribeToChatTyping(
    _chatId: string,
    _listener: ChatTypingListener,
  ): () => void {
    void _chatId;
    void _listener;
    return () => {};
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
   * chat for one, a group for several) and resolves with it. Idempotent by
   * default where it can be: a driver that already has a conversation for the
   * set SHOULD return it rather than create a duplicate — `name` and `spaceId`
   * are only applied on that actual-creation path, so they're silently ignored
   * when an existing conversation is reused. `spaceId` attaches the new
   * conversation as that espace's child (the Salon creation flow), so it
   * actually shows up under it. Set `forceNew` to skip the reuse check
   * entirely — the Salon flow does this: naming a salon and picking its espace
   * is an explicit request for a new room, even if the same people already
   * share an unrelated chat elsewhere; silently redirecting into that chat
   * instead would just look like the salon never got created. Drives the New
   * Chat "start a conversation" flow — the UI creates the conversation lazily,
   * on confirming the selection. Unsupported by default so drivers opt in (see
   * `supportsConversationCreation`).
   */
  async createChatForUsers(
    _userIds: string[],
    _name?: string,
    _spaceId?: string,
    _forceNew?: boolean,
  ): Promise<LocalChat> {
    void _userIds;
    void _name;
    void _spaceId;
    void _forceNew;
    throw new Error(
      `${this.constructor.name}.createChatForUsers: creating a conversation is not supported by this driver.`,
    );
  }

  // --- Avatars -------------------------------------------------------------
  // Unsupported by default so drivers opt in; gates the photo-change actions
  // on the account menu and the group chat header.
  readonly supportsAvatarUpload: boolean = false;

  /** Uploads `file` and sets it as the current user's own avatar. Resolves
   * with the new photo's `ChatVisual.url` — a driver-specific identifier
   * (for Matrix, an `mxc://` URI), not necessarily a directly fetchable
   * link; render it through `resolveAvatarUrl`. */
  async setUserAvatar(_file: File): Promise<string> {
    void _file;
    throw new Error(
      `${this.constructor.name}.setUserAvatar: avatar upload is not supported by this driver.`,
    );
  }

  /** Uploads `file` and sets it as `chatId`'s avatar (group chats only —
   * a direct chat's photo comes from its counterpart's own avatar). Resolves
   * with the new photo's `ChatVisual.url` (see `setUserAvatar`). */
  async setChatAvatar(_chatId: string, _file: File): Promise<string> {
    void _chatId;
    void _file;
    throw new Error(
      `${this.constructor.name}.setChatAvatar: avatar upload is not supported by this driver.`,
    );
  }

  /** The current user's own avatar as a `ChatVisual.url` (see
   * `setUserAvatar`), or `undefined` if none is set. Unsupported drivers
   * (or one with no avatar) report `undefined` rather than throwing — this
   * is read on every load to show the account menu's own icon, not just
   * right after a change. */
  async getUserAvatarUrl(): Promise<string | undefined> {
    return undefined;
  }

  /**
   * Resolves a `ChatVisual.url` (of kind `"image"`) to a URL an `<img>` can
   * actually load. Identity by default — most backends' avatar URLs are
   * already directly fetchable. Matrix overrides this: its `mxc://` URIs
   * need translating, and this homeserver requires an authenticated
   * request a plain `<img src>` can't make, so it fetches the photo itself
   * and returns a local `blob:` URL.
   */
  async resolveAvatarUrl(url: string): Promise<string> {
    return url;
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
  // backends that need no handshake need not override them. Stateful backends
  // override `connect` to drive an auth flow. Connection state is
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
