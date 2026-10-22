import type {
  ChatMessage,
  ChatRef,
  ChatThreadDetail,
} from "@/features/drivers/types";

/**
 * This session's thread replies on their way: the optimistic row, then the
 * confirmed message until a loaded thread shows it. A thread reloaded
 * meanwhile keeps them, as Element appends its pending events to the thread
 * it shows: the driver's projection leaves out events still being sent.
 */
const HELD_REPLY_MS = 60_000;

type HeldReply = { message: ChatMessage; heldAt: number };

const held = new Map<string, HeldReply[]>();

const keyOf = (ref: ChatRef, threadId: string): string =>
  `${ref.accountId}\u0000${ref.chatId}\u0000${threadId}`;

/** The replies held for a thread, without those held for too long. */
const heldOf = (key: string): HeldReply[] => {
  const now = Date.now();
  const recent = (held.get(key) ?? []).filter(
    ({ heldAt }) => now - heldAt < HELD_REPLY_MS,
  );
  if (recent.length > 0) {
    held.set(key, recent);
  } else {
    held.delete(key);
  }
  return recent;
};

export const holdThreadReply = (
  ref: ChatRef,
  threadId: string,
  message: ChatMessage,
): void => {
  const key = keyOf(ref, threadId);
  held.set(key, [...heldOf(key), { message, heldAt: Date.now() }]);
};

/** Holds the confirmed message in place of its optimistic row. */
export const confirmThreadReply = (
  ref: ChatRef,
  threadId: string,
  optimisticId: string,
  message: ChatMessage,
): void => {
  const key = keyOf(ref, threadId);
  held.set(
    key,
    heldOf(key).map((reply) =>
      reply.message.id === optimisticId
        ? { message, heldAt: Date.now() }
        : reply,
    ),
  );
};

export const releaseThreadReply = (
  ref: ChatRef,
  threadId: string,
  messageId: string,
): void => {
  const key = keyOf(ref, threadId);
  const remaining = heldOf(key).filter(
    (reply) => reply.message.id !== messageId,
  );
  if (remaining.length > 0) {
    held.set(key, remaining);
  } else {
    held.delete(key);
  }
};

/**
 * A loaded thread followed by the held replies it does not show yet. Those it
 * shows are released: the thread now has them.
 */
export const withHeldThreadReplies = (
  ref: ChatRef,
  threadId: string,
  detail: ChatThreadDetail,
): ChatThreadDetail => {
  const key = keyOf(ref, threadId);
  const shownIds = new Set(detail.messages.map((message) => message.id));
  const missing = heldOf(key).filter(
    (reply) => !shownIds.has(reply.message.id),
  );
  if (missing.length > 0) {
    held.set(key, missing);
  } else {
    held.delete(key);
  }
  return missing.length > 0
    ? {
        ...detail,
        messages: [
          ...detail.messages,
          ...missing.map((reply) => reply.message),
        ],
      }
    : detail;
};

/** Forgets every held reply, as a fresh session starts without any. */
export const clearHeldThreadReplies = (): void => held.clear();
