import { FooterProps } from "@gouvfr-lasuite/ui-kit";

import { AvatarColor } from "@/features/ui/components/avatar/palette";

export type AccountId = string;

export type DriverKind = "mock" | "matrix";

export type ChatRef = {
  accountId: AccountId;
  chatId: string;
};

export type ChatAccountConfig = {
  accountId: AccountId;
  kind: DriverKind;
  label: string;
  criticality: "required" | "optional";
  enabled: boolean;
  settings?: Record<string, unknown>;
};

export type ChatScope = {
  scopeId: string;
  label: string;
  kind: "aggregate" | "server";
  isDefault?: boolean;
  accounts: ChatAccountConfig[];
};

export type User = {
  id: string;
  email: string;
  full_name?: string;
  short_name?: string;
  language: string | null;
  last_release_note_seen?: string | null;
};

/**
 * Visual identity of a conversation row: initials avatar, an emoji, or a
 * Material-icon name. The shape mirrors what the backend will eventually
 * return as the `visual` field of a `Chat`.
 */
export type ChatVisual =
  | { kind: "initials" }
  | { kind: "emoji"; emoji: string }
  | { kind: "icon"; icon: string };

/**
 * Read state lives outside the conversation and message payloads so a receipt
 * can move the unread dot without invalidating either cache. `highlight` is a
 * stronger Matrix notification (for example a mention).
 */
export type ChatUnread = {
  unread: boolean;
  highlight: boolean;
};

/**
 * The current user's relationship to a conversation. `join` is a normal,
 * sendable conversation; `invite` is a pending incoming invitation that must be
 * accepted before its timeline becomes available. Driver-neutral: the Matrix
 * driver maps it from `room.getMyMembership()`. Optional on `LocalChat` for
 * backwards compatibility — a chat without it is treated as `join` (see
 * `isInvitationChat`).
 */
export type ChatMembership = "join" | "invite";

/**
 * Metadata of a pending incoming invitation, carried on an `invite` chat so the
 * invitation view can show who invited the user, when, and why. All fields are
 * optional because an invite room exposes only sparse state.
 */
export type ChatInvitation = {
  /** Matrix id (or backend handle) of the person who sent the invite. */
  inviterId?: string;
  /** Display name of the inviter, when the room state carries it. */
  inviterName?: string;
  /** Free-text reason attached to the invite, when present. */
  reason?: string;
  /** ISO 8601 timestamp of the invitation event, when known. */
  invitedAt?: string;
  /** Whether the invite marks a direct (one-to-one) conversation. */
  isDirect?: boolean;
};

export type LocalChat = {
  id: string;
  lastActivityAt?: string;
  name: string;
  section: "favourites" | "all";
  /**
   * Determines whether the conversation has a single counterpart or several.
   * Explicit (rather than inferred from the name) so the data shape stays
   * stable when the real backend ships.
   */
  kind: "direct" | "group";
  /**
   * User ids that make up the conversation. The current user is implicit, so a
   * direct chat carries one participant and a group chat carries two or more.
   */
  participantIds: string[];
  visual: ChatVisual;
  /**
   * The current user's membership. Optional for backwards compatibility: chats
   * that omit it are treated as joined (see `isInvitationChat`). Matrix-mapped
   * chats always set it.
   */
  membership?: ChatMembership;
  /** Invitation metadata; present only when `membership === "invite"`. */
  invitation?: ChatInvitation;
};

export type Chat = LocalChat & {
  accountId: AccountId;
  ref: ChatRef;
};

export type LocalChatSections = {
  favourites: LocalChat[];
  all: LocalChat[];
};

export type ChatSections = {
  favourites: Chat[];
  all: Chat[];
};

export type MergedChatsResult = ChatSections & {
  byAccount: Map<AccountId, ChatSections>;
  accountErrors: Map<AccountId, unknown>;
  isLoadingRequiredAccounts: boolean;
  isLoading: boolean;
  isError: boolean;
};

export type LocalizedThemeCustomization<T> = {
  default: T;
  [key: string]: T;
};

export interface ThemeCustomization {
  footer?: LocalizedThemeCustomization<FooterProps>;
}

export type ApiConfig = {
  POSTHOG_KEY?: string;
  POSTHOG_HOST?: string;
  FRONTEND_THEME?: string;
  FRONTEND_HIDE_GAUFRE?: boolean;
  FRONTEND_SILENT_LOGIN_ENABLED?: boolean;
  FRONTEND_EXTERNAL_HOME_URL?: string;
  FRONTEND_CSS_URL?: string;
  FRONTEND_JS_URL?: string;
  theme_customization?: ThemeCustomization;
};

export interface APIList<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export type ChatMessageAuthor = {
  id: string;
  name: string;
  initials: string;
  color: AvatarColor;
};

export type ChatUser = ChatMessageAuthor & {
  email: string;
  /** Secondary line shown in people search results. */
  subtitle: string;
};

/**
 * A member of one conversation. Kept separate from `ChatUser`: room membership
 * comes from the room state and may expose less profile data than directory
 * search. `secondaryText` is an email/organization in mocks and the Matrix id
 * when Matrix has no richer profile field.
 */
export type ChatMember = {
  id: string;
  name: string;
  secondaryText: string;
};

/** Read-only membership snapshot used by the conversation members modal. */
export type ChatMembers = {
  present: ChatMember[];
  pendingInvites: ChatMember[];
};

/**
 * One emoji's worth of reactions on a message, aggregated across users. The UI
 * only needs the count and whether the current user is part of it — no per-user
 * list is carried (see the `chat-message-reactions` design).
 */
export type ChatReaction = {
  /** Native emoji character, e.g. "👍". */
  emoji: string;
  /** Number of users who reacted with this emoji. Always >= 1 when present. */
  count: number;
  /** Whether the current user reacted with this emoji. */
  reactedByMe: boolean;
};

/**
 * Lightweight thread marker carried on the message a thread hangs off. Present
 * only on messages that started a thread — drives the thread button rendered
 * under the bubble (see the `chat-thread-button` design).
 */
export type ChatThreadSummary = {
  /** Thread id — used to open the thread detail panel. */
  id: string;
  /** Total number of replies in the thread. */
  replyCount: number;
  /** Replies the current user has not read yet. `0` when fully read. */
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  authorId: string;
  content: string;
  /** ISO 8601 string. Use `formatChatTime` from @/features/chat/formatTimestamp for display. */
  timestamp: string;
  /** Aggregated reactions, in stable insertion order. Empty when none. */
  reactions: ChatReaction[];
  /** Matrix redaction rendered as a stable tombstone rather than a removed row. */
  isDeleted?: boolean;
  /** Whether the visible body comes from an `m.replace` relation. */
  isEdited?: boolean;
  /** Server-derived permissions for the connected user. */
  canEdit?: boolean;
  canDelete?: boolean;
  /** Set when this message opened a thread; omitted otherwise. */
  thread?: ChatThreadSummary;
};

/** Volatile room member identity used only by the typing indicator. */
export type ChatTypingUser = {
  id: string;
  name: string;
};

export type ChatMessagesPage = {
  messages: ChatMessage[];
  authors: ChatMessageAuthor[];
  nextCursor: string | null;
};

export type ChatDocumentKind = "file" | "folder" | "link";

export type ChatDocument = {
  id: string;
  title: string;
  /**
   * Mimetype consumed by the UI Kit `FileIcon`. Ignored for `folder` and
   * `link` kinds (rendered with dedicated icons instead).
   */
  mimetype: string;
  kind: ChatDocumentKind;
  isShared?: boolean;
  /** File size in bytes — required by the UI Kit `FilePreviewType`. */
  size?: number;
  /** Source URL for the file or external link. */
  url?: string;
  /** Optional preview URL; falls back to `url` when omitted. */
  urlPreview?: string;
};

/**
 * Documents grouped exactly as the tools panel renders them. The driver is the
 * swap point: a real backend may return this shape directly, or return a flat
 * list that the driver groups.
 */
export type ChatDocumentsPage = {
  pinned: ChatDocument[];
  shared: ChatDocument[];
  multimedia: ChatDocument[];
};

/**
 * One row of the threads tools panel — a thread scoped to a single
 * conversation. The driver is the swap point: a real backend returns this
 * shape, or a richer one the driver narrows down.
 */
export type ChatThread = {
  id: string;
  /** Id of the message the thread hangs off. */
  rootMessageId: string;
  /** Author of the most recent reply — shown in the list row. */
  author: ChatMessageAuthor;
  /** ISO 8601 timestamp of the most recent reply. */
  lastReplyAt: string;
  /** Preview text of the most recent reply. */
  lastReplyPreview: string;
  /** Lets the UI localize a redacted latest-reply tombstone. */
  lastReplyDeleted?: boolean;
  /** Total number of replies. */
  replyCount: number;
  /** Replies the current user has not read yet. `0` when fully read. */
  unreadCount: number;
};

/**
 * Full content of a single thread, shown in the thread detail view: the root
 * message followed by its replies.
 */
export type ChatThreadDetail = {
  id: string;
  rootMessageId: string;
  /** Root message first, then replies in chronological order. */
  messages: ChatMessage[];
  /** Authors referenced by `messages`, for avatar/name lookup. */
  authors: ChatMessageAuthor[];
  /**
   * Index in `messages` of the first unread reply, or `null` when nothing is
   * unread. Drives the "Unread" separator in the detail view.
   */
  firstUnreadIndex: number | null;
};

export type ChatThreadMutationResult = {
  /** Reply message that was sent inside the thread. */
  message: ChatMessage;
  /** Updated thread list row. */
  thread: ChatThread;
  /** Updated thread detail snapshot. */
  threadDetail: ChatThreadDetail;
  /** Root timeline message with its latest thread summary. */
  rootMessage: ChatMessage;
};

/**
 * Content of a user from the chat engine
 */
export type ChatLocalUser = {
  userId: string;
  accessToken: string;
  refreshToken?: string;
};
