import { FooterProps } from "@gouvfr-lasuite/ui-kit";

import { AvatarColor } from "@/features/ui/components/avatar/palette";

export type User = {
  id: string;
  email: string;
  full_name?: string;
  short_name?: string;
  language: string | null;
  last_release_note_seen?: string | null;
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

export type ChatMessage = {
  id: string;
  authorId: string;
  content: string;
  /** ISO 8601 string. Use `formatChatTime` from @/features/chat/formatTimestamp for display. */
  timestamp: string;
  /** Aggregated reactions, in stable insertion order. Empty when none. */
  reactions: ChatReaction[];
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
