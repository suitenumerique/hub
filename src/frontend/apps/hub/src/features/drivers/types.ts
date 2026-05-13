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

export type ChatMessage = {
  id: string;
  authorId: string;
  content: string;
  /** ISO 8601 string. Use `formatChatTime` from @/features/chat/formatTimestamp for display. */
  timestamp: string;
};

export type ChatMessagesPage = {
  messages: ChatMessage[];
  authors: ChatMessageAuthor[];
  nextCursor: string | null;
};
