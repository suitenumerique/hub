import { type CaptureOptions, posthog } from "posthog-js";

import type {
  ChatEffectiveNotificationLevel,
  ChatNotificationLevel,
  LocalChat,
} from "@/features/drivers/types";

export type ChatType = "dm" | "dm_group";

/**
 * The product events and their properties. Naming follows Accounts:
 * `domain:action`, properties in snake_case. No event may carry message
 * content, file names or Matrix ids.
 */
type AnalyticsEvents = {
  "auth:log-in": Record<string, never>;
  "chat-account:connected": Record<string, never>;
  "chat-account:sign-in-failed": {
    reason: "invalid-email" | "unknown-server" | "unavailable";
  };
  "connection:error-shown": { reason: string };
  "encryption:verification-completed": {
    result: "verified" | "mismatch" | "cancelled" | "expired" | "error";
  };
  "encryption:ready": { history: "complete" | "partial" };
  "chat:opened": {
    source: "chat_list" | "search" | "notification";
    chat_type?: ChatType;
  };
  "chat:created": { participant_count: number };
  "message:sent": {
    trigger: "enter" | "send_button";
    has_attachment: boolean;
    chat_type?: ChatType;
  };
  "thread:started": { chat_type?: ChatType };
  "thread:replied": { chat_type?: ChatType };
  "message:action-used": {
    action:
      | "react_quick"
      | "react_picker"
      | "reply"
      | "copy"
      | "edit"
      | "delete";
    trigger: "right_click" | "hover_button";
    is_own_message: boolean;
    surface: "main" | "thread";
  };
  "attachment:added": { method: "attach_button" | "drag_and_drop" | "paste" };
  "chat:action-used": {
    action: "favourite_add" | "favourite_remove" | "mark_read" | "mark_unread";
    trigger:
      | "chat_header_menu"
      | "chat_list_more_button"
      | "chat_list_right_click";
  };
  chat_notification_level_changed: {
    previous_level?: ChatNotificationLevel;
    level: ChatEffectiveNotificationLevel;
  };
  "decryption:failed": {
    /** Failure code of the SDK. */
    reason: string;
    /** Set when the key arrives between 4 and 60 seconds. */
    time_to_decrypt_ms?: number;
    was_visible_to_user: boolean;
    user_trusts_own_identity: boolean;
    is_federated?: boolean;
    event_local_age_ms?: number;
    chat_type?: ChatType;
  };
  "decryption:summary": {
    encrypted_messages_shown: number;
    undecryptable_count: number;
    undecryptable_ratio: number;
  };
};

/** One property of an event, for the code that carries it to `trackEvent`. */
export type EventProperty<
  Event extends keyof AnalyticsEvents,
  Name extends keyof AnalyticsEvents[Event],
> = AnalyticsEvents[Event][Name];

const STORAGE_PREFIX = "hub-analytics:";
const LOGIN_STARTED_KEY = `${STORAGE_PREFIX}login-started`;

/** PostHog only starts when the environment configures it. */
export const isAnalyticsEnabled = (): boolean => posthog.__loaded;

export const trackEvent = <Event extends keyof AnalyticsEvents>(
  event: Event,
  properties: AnalyticsEvents[Event],
  options?: CaptureOptions,
): void => {
  if (isAnalyticsEnabled()) posthog.capture(event, properties, options);
};

/** Everyone is known by their Hub user id, in the frontend and the backend. */
export const identifyUser = (user: {
  id: string;
  email: string;
  sub?: string;
}): void => {
  if (!isAnalyticsEnabled()) return;
  posthog.identify(user.id, {
    email: user.email,
    ...(user.sub ? { sub: user.sub } : {}),
  });
};

export const setPersonProperties = (properties: {
  tchap_server?: string;
  has_other_tchap_session?: boolean;
}): void => {
  if (isAnalyticsEnabled()) posthog.setPersonProperties(properties);
};

export const resetAnalyticsIdentity = (): void => {
  if (isAnalyticsEnabled()) posthog.reset();
};

export const chatTypeOf = (
  chat: Pick<LocalChat, "kind"> | null | undefined,
): ChatType | undefined => {
  if (!chat) return undefined;
  return chat.kind === "direct" ? "dm" : "dm_group";
};

/** Storage may be unavailable: analytics never gets in the way of the Hub. */
const safely = <Result>(run: () => Result): Result | undefined => {
  try {
    return run();
  } catch {
    return undefined;
  }
};

export const readAnalyticsStorage = (name: string): string | null =>
  safely(() => localStorage.getItem(`${STORAGE_PREFIX}${name}`)) ?? null;

export const writeAnalyticsStorage = (name: string, value: string): void => {
  safely(() => localStorage.setItem(`${STORAGE_PREFIX}${name}`, value));
};

/** What an account leaves behind on this browser goes with it at logout. */
export const clearAnalyticsStorage = (): void => {
  safely(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => localStorage.removeItem(key)),
  );
};

/** The Hub leaves for its identity provider and comes back in this same tab. */
export const markLoginStarted = (): void => {
  safely(() => sessionStorage.setItem(LOGIN_STARTED_KEY, "true"));
};

/** Once the Hub session is open: a reload of the page is not a new login. */
export const trackLoginCompleted = (): void => {
  if (!safely(() => sessionStorage.getItem(LOGIN_STARTED_KEY))) return;
  safely(() => sessionStorage.removeItem(LOGIN_STARTED_KEY));
  trackEvent("auth:log-in", {});
};
