import type { ChatMembership, LocalChat } from "@/features/drivers/types";

/**
 * The current user's membership in a conversation, defaulting to `join` when a
 * chat omits it. Keeping the default in one place lets existing mock data and
 * any pre-membership cache entry stay valid: a chat with no explicit membership
 * is a normal, joined conversation, never an invitation.
 */
export const chatMembership = (
  chat: Pick<LocalChat, "membership"> | null | undefined,
): ChatMembership => chat?.membership ?? "join";

/**
 * Whether a chat is a pending incoming invitation rather than a joined
 * conversation. The single predicate the UI branches on, so timeline, composer,
 * and tools surfaces are suppressed for invites without scattering
 * `membership === "invite"` checks across components.
 */
export const isInvitationChat = (
  chat: Pick<LocalChat, "membership"> | null | undefined,
): boolean => chatMembership(chat) === "invite";
