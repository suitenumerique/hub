import type { ChatRef } from "@/features/drivers/types";

/**
 * Messages whose reaction toggle is in flight. Their optimistic chips stand
 * until the driver answers: a homeserver snapshot or a reloaded copy read
 * before the toggle must not overwrite them meanwhile.
 */
const pending = new Map<string, number>();

const keyOf = (ref: ChatRef, messageId: string): string =>
  `${ref.accountId}\u0000${ref.chatId}\u0000${messageId}`;

export const beginReactionToggle = (ref: ChatRef, messageId: string): void => {
  const key = keyOf(ref, messageId);
  pending.set(key, (pending.get(key) ?? 0) + 1);
};

export const endReactionToggle = (ref: ChatRef, messageId: string): void => {
  const key = keyOf(ref, messageId);
  const count = (pending.get(key) ?? 1) - 1;
  if (count > 0) {
    pending.set(key, count);
  } else {
    pending.delete(key);
  }
};

export const isReactionTogglePending = (
  ref: ChatRef,
  messageId: string,
): boolean => pending.has(keyOf(ref, messageId));
