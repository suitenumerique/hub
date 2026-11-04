import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatAttachment,
  ChatComposedMessage,
  ChatMessage,
  ChatRef,
} from "@/features/drivers/types";

/**
 * A message the server has not confirmed. As in Element, one that could not be
 * sent stays in its conversation or thread, below the others, until it is sent
 * again or discarded.
 */
export type FailedMessage = {
  /** The id of its optimistic row, which it replaces in the list. */
  id: string;
  message: ChatComposedMessage;
  attachment?: ChatAttachment;
  timestamp: string;
  /** Kept across attempts: the server never records the message twice. */
  transactionId: string;
};

/**
 * Written as soon as the message is, so closing the tab during its send does
 * not lose it. Kept in this browser as plain text like the composer drafts, an
 * encrypted file's key included: logging out erases them all, and leaving a
 * conversation erases its own.
 */
const STORAGE_PREFIX = "hubFailedMessages:";
const NONE: readonly FailedMessage[] = [];

// What is on disk, and what the lists show: without the messages this page is
// still sending, which they show as ordinary rows. One stable array per key, as
// useSyncExternalStore needs.
const stored = new Map<string, readonly FailedMessage[]>();
const shown = new Map<string, readonly FailedMessage[]>();
const sending = new Set<string>();
const listeners = new Set<() => void>();

const storageKey = (ref: ChatRef, threadId?: string): string | null => {
  const owner = getRegistry()
    .getSnapshot()
    .find(({ accountId }) => accountId === ref.accountId)?.sessionOwner;
  if (!owner) {
    return null;
  }
  const chat = `${STORAGE_PREFIX}${owner}:${ref.accountId}:${ref.chatId}`;
  return threadId ? `${chat}:${threadId}` : chat;
};

const notify = () => listeners.forEach((listener) => listener());

/** What another version wrote, or a damaged entry, must not break the chat. */
const isFailedMessage = (value: unknown): value is FailedMessage => {
  const candidate = value as Partial<FailedMessage> | null;
  return (
    typeof candidate?.id === "string" &&
    typeof candidate.timestamp === "string" &&
    typeof candidate.transactionId === "string" &&
    typeof candidate.message?.content === "string"
  );
};

const readStored = (key: string): readonly FailedMessage[] => {
  let list = stored.get(key);
  if (!list) {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      list = Array.isArray(parsed) ? parsed.filter(isFailedMessage) : NONE;
    } catch {
      // Unavailable storage or an unreadable entry: nothing to show.
      list = NONE;
    }
    stored.set(key, list);
  }
  return list;
};

const write = (key: string, list: readonly FailedMessage[]) => {
  stored.set(key, list);
  shown.delete(key);
  try {
    if (list.length > 0) {
      localStorage.setItem(key, JSON.stringify(list));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Full storage: the message still stays in this page.
  }
  notify();
};

export const subscribeToFailedMessages = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const createTransactionId = (): string =>
  `hub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** The messages that could not be sent, as the lists show them. */
export const getFailedMessages = (
  ref: ChatRef,
  threadId?: string,
): readonly FailedMessage[] => {
  const key = storageKey(ref, threadId);
  if (!key) {
    return NONE;
  }
  let list = shown.get(key);
  if (!list) {
    list = readStored(key).filter(({ id }) => !sending.has(id));
    shown.set(key, list);
  }
  return list;
};

/** Keeps a message from the moment it is written until the server has it. */
export const trackSendingMessage = (
  ref: ChatRef,
  threadId: string | undefined,
  message: FailedMessage,
) => {
  const key = storageKey(ref, threadId);
  if (key) {
    sending.add(message.id);
    write(key, [...readStored(key), message]);
  }
};

/** The send failed: the lists now show the message as such. */
export const markMessageFailed = (
  ref: ChatRef,
  threadId: string | undefined,
  id: string,
) => {
  const key = storageKey(ref, threadId);
  if (key) {
    sending.delete(id);
    shown.delete(key);
    notify();
  }
};

/** The server has it, or it is dropped or about to be sent again. */
export const removeFailedMessage = (
  ref: ChatRef,
  threadId: string | undefined,
  id: string,
) => {
  const key = storageKey(ref, threadId);
  if (key && readStored(key).some((message) => message.id === id)) {
    sending.delete(id);
    write(
      key,
      readStored(key).filter((message) => message.id !== id),
    );
  }
};

const removeEntries = (matches: (key: string) => boolean) => {
  [...stored.keys()].filter(matches).forEach((key) => {
    stored.delete(key);
    shown.delete(key);
  });
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX) && matches(key))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Unavailable storage holds nothing to remove.
  }
  notify();
};

/** Forgets what failed in a conversation and in its threads. */
export const removeChatFailedMessages = ({ accountId, chatId }: ChatRef) => {
  removeEntries((key) => key.includes(`:${accountId}:${chatId}`));
};

/** Forgets every failed message kept in this browser. */
export const clearFailedMessages = () => {
  removeEntries(() => true);
};

/** The failed messages as rows, after the loaded ones. */
export const withFailedMessages = (
  messages: ChatMessage[],
  failed: readonly FailedMessage[],
): ChatMessage[] => {
  if (failed.length === 0) {
    return messages;
  }
  const failedIds = new Set(failed.map(({ id }) => id));
  return [
    ...messages.filter(({ id }) => !failedIds.has(id)),
    ...failed.map(
      ({ id, message, attachment, timestamp }): ChatMessage => ({
        id,
        authorId: "me",
        content: message.content,
        ...(message.htmlContent ? { htmlContent: message.htmlContent } : {}),
        ...(attachment ? { attachment } : {}),
        timestamp,
        reactions: [],
        sendFailed: true,
      }),
    ),
  ];
};
