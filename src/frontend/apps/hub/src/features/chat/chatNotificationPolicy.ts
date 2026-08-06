type RoomMutePolicyInput = {
  roomMuted: boolean;
};

type ThreadAttentionPolicyInput = {
  threadMuted: boolean;
  isMention: boolean;
};

type NotificationPolicyInput = RoomMutePolicyInput & ThreadAttentionPolicyInput;

type ThreadAttentionUnreadInput = {
  threadMuted: boolean;
  unreadCount: number;
  highlightCount: number;
};

/** A muted room never advances its ranking cursor, including for mentions. */
export const shouldBumpRoom = ({ roomMuted }: RoomMutePolicyInput): boolean =>
  !roomMuted;

/** Mentions are the only unread attention allowed through a thread mute. */
export const shouldSurfaceThreadUnread = ({
  threadMuted,
  isMention,
}: ThreadAttentionPolicyInput): boolean => isMention || !threadMuted;

/**
 * Shared policy for future Hub notification and sound producers. Mentions are
 * the sole exception when either containing scope is muted.
 */
export const shouldNotifyOrSound = ({
  roomMuted,
  threadMuted,
  isMention,
}: NotificationPolicyInput): boolean =>
  isMention || (!roomMuted && !threadMuted);

/**
 * Returns visual thread attention without mutating receipt-derived counts.
 * A muted thread exposes only mention highlights, never its ordinary backlog.
 */
export const getThreadAttentionUnreadCount = ({
  threadMuted,
  unreadCount,
  highlightCount,
}: ThreadAttentionUnreadInput): number =>
  Math.max(0, threadMuted ? highlightCount : unreadCount);
