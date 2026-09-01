import type { InfiniteData } from "@tanstack/react-query";
import type { TFunction } from "i18next";

import type {
  ChatMessage,
  ChatMessageWindow,
  ChatRef,
  ChatThread,
  ChatThreadDetail,
  ChatThreadSummary,
} from "@/features/drivers/types";

export type ChatMessagesData = InfiniteData<ChatMessageWindow>;

const chatMessageEventVersions = new Map<string, number>();
const snapshotEventVersion = Symbol("chat-message-snapshot-event-version");

type VersionedChatMessageWindow = ChatMessageWindow & {
  [snapshotEventVersion]?: number;
};

const chatMessageEventVersionKey = (ref: ChatRef): string =>
  ref.accountId + "\u0000" + ref.chatId;

export const getChatMessageEventVersion = (ref: ChatRef): number =>
  chatMessageEventVersions.get(chatMessageEventVersionKey(ref)) ?? 0;

export const bumpChatMessageEventVersion = (ref: ChatRef): void => {
  const key = chatMessageEventVersionKey(ref);
  chatMessageEventVersions.set(
    key,
    (chatMessageEventVersions.get(key) ?? 0) + 1,
  );
};

export const tagChatMessageWindowEventVersion = (
  snapshot: ChatMessageWindow,
  version: number,
): ChatMessageWindow => {
  Object.defineProperty(snapshot, snapshotEventVersion, { value: version });
  return snapshot;
};

export const getChatMessageWindowEventVersion = (
  snapshot: ChatMessageWindow | undefined,
): number | undefined =>
  (snapshot as VersionedChatMessageWindow | undefined)?.[snapshotEventVersion];

const updateMessageSnapshot = (
  data: ChatMessagesData,
  update: (snapshot: ChatMessageWindow) => ChatMessageWindow,
): ChatMessagesData => {
  const snapshot = data.pages[0];
  if (!snapshot) {
    return data;
  }
  const nextSnapshot = update(snapshot);
  return nextSnapshot === snapshot ? data : { ...data, pages: [nextSnapshot] };
};

/**
 * Optimistic author for the current user's own thread replies, shown until the
 * server echoes the real author back. Built from `t` rather than a module-level
 * constant so the labels are translated — call it from a hook where
 * `useTranslation` is available.
 */
export const createCurrentUserThreadAuthor = (
  t: TFunction,
): ChatThread["author"] => ({
  id: "me",
  name: t("You"),
  initials: t("ME"),
  color: "blue-1",
});

let optimisticId = 0;

export const OPTIMISTIC_THREAD_ID_PREFIX = "optimistic-thread-";

const optimisticRootThreadSummaryMarker = Symbol(
  "optimistic-root-thread-summary",
);

export type RootThreadSummaryMutationMarker = object | string;

type MarkedThreadSummary = ChatThreadSummary & {
  [optimisticRootThreadSummaryMarker]?: RootThreadSummaryMutationMarker;
};

const optimisticThreadUnreadMarker = Symbol("optimistic-thread-unread");
const optimisticRootThreadUnreadMarker = Symbol(
  "optimistic-root-thread-unread",
);

export type ThreadUnreadMutationMarker = object;

type MarkedThread = ChatThread & {
  [optimisticThreadUnreadMarker]?: ThreadUnreadMutationMarker;
};

type MarkedRootThreadUnread = ChatThreadSummary & {
  [optimisticRootThreadUnreadMarker]?: ThreadUnreadMutationMarker;
};

export const isOptimisticThreadId = (threadId: string): boolean =>
  threadId.startsWith(OPTIMISTIC_THREAD_ID_PREFIX);

export const markOptimisticRootThreadSummary = (
  summary: ChatThreadSummary,
  marker: RootThreadSummaryMutationMarker,
): ChatThreadSummary =>
  ({
    ...summary,
    [optimisticRootThreadSummaryMarker]: marker,
  }) as MarkedThreadSummary;

export const hasOptimisticRootThreadSummaryMutation = (
  summary: ChatThreadSummary,
  marker: RootThreadSummaryMutationMarker,
): boolean =>
  (summary as MarkedThreadSummary)[optimisticRootThreadSummaryMarker] ===
  marker;

export const markOptimisticThreadUnread = (
  thread: ChatThread,
  marker: ThreadUnreadMutationMarker,
): ChatThread => {
  const marked = { ...thread } as MarkedThread;
  Object.defineProperty(marked, optimisticThreadUnreadMarker, {
    value: marker,
  });
  return marked;
};

export const hasOptimisticThreadUnreadMutation = (
  thread: ChatThread,
  marker: ThreadUnreadMutationMarker,
): boolean => getOptimisticThreadUnreadMarker(thread) === marker;

export const getOptimisticThreadUnreadMarker = (
  thread: ChatThread,
): ThreadUnreadMutationMarker | undefined =>
  (thread as MarkedThread)[optimisticThreadUnreadMarker];

export const markOptimisticRootThreadUnread = (
  summary: ChatThreadSummary,
  marker: ThreadUnreadMutationMarker,
): ChatThreadSummary => {
  const marked = { ...summary, unreadCount: 0 } as MarkedRootThreadUnread;
  Object.defineProperty(marked, optimisticRootThreadUnreadMarker, {
    value: marker,
  });
  return marked;
};

export const hasOptimisticRootThreadUnreadMutation = (
  summary: ChatThreadSummary,
  marker: ThreadUnreadMutationMarker,
): boolean => getOptimisticRootThreadUnreadMarker(summary) === marker;

export const getOptimisticRootThreadUnreadMarker = (
  summary: ChatThreadSummary,
): ThreadUnreadMutationMarker | undefined =>
  (summary as MarkedRootThreadUnread)[optimisticRootThreadUnreadMarker];

export const createOptimisticMessage = (
  content: string,
  prefix: string,
): ChatMessage => {
  optimisticId += 1;
  return {
    id: `${prefix}-${optimisticId}`,
    authorId: "me",
    content,
    timestamp: new Date().toISOString(),
    reactions: [],
    isPending: true,
  };
};

export type ChatMessageWindowMergeMode = "older" | "newer" | "replace";

const hasOptimisticSymbolMarker = (message: ChatMessage): boolean =>
  Object.getOwnPropertySymbols(message).length > 0 ||
  (message.thread !== undefined &&
    Object.getOwnPropertySymbols(message.thread).length > 0);

/**
 * Overlays volatile cache mutations on a fresh driver snapshot.
 *
 * The incoming snapshot owns all timeline structure (`windowId`, marker and
 * pagination flags). Existing objects carrying a local symbol marker are kept
 * only while the same event remains in the incoming window. Pending sends are
 * carried across pagination/re-anchoring only when the incoming snapshot still
 * contains the live end; a contextual snapshot intentionally drops them.
 *
 * Keeping a marked object also temporarily keeps all its fields, so unrelated
 * remote changes to that row are applied after the mutation settles or a later
 * unmarked driver event replaces it. Marked rows which leave the bounded
 * window cannot be preserved in this cache.
 * A directional response for a superseded `windowId` is rejected; only an
 * explicit replacement may install a new window generation.
 */
export const mergeChatMessageWindowSnapshot = (
  current: ChatMessageWindow | undefined,
  incoming: ChatMessageWindow,
  mode: ChatMessageWindowMergeMode,
): ChatMessageWindow => {
  if (!current) {
    return incoming;
  }
  if (mode !== "replace" && current.windowId !== incoming.windowId) {
    return current;
  }

  const currentById = new Map(
    current.messages.map((message) => [message.id, message]),
  );
  const incomingIds = new Set(incoming.messages.map((message) => message.id));
  const messages = incoming.messages.map((message) => {
    const existing = currentById.get(message.id);
    if (existing && hasOptimisticSymbolMarker(existing)) {
      return existing;
    }
    return message;
  });

  if (!incoming.hasNewer) {
    messages.push(
      ...current.messages.filter(
        (message) => message.isPending === true && !incomingIds.has(message.id),
      ),
    );
  }

  const referencedCurrentAuthorIds = new Set(
    messages
      .filter((message) => currentById.get(message.id) === message)
      .map((message) => message.authorId),
  );
  const incomingAuthorIds = new Set(
    incoming.authors.map((author) => author.id),
  );
  const authors = [
    ...incoming.authors,
    ...current.authors.filter(
      (author) =>
        referencedCurrentAuthorIds.has(author.id) &&
        !incomingAuthorIds.has(author.id),
    ),
  ];

  return { ...incoming, messages, authors };
};

/** Appends to the single cached snapshot when it contains the live end. */
export const appendMessageToNewestPage = (
  data: ChatMessagesData,
  message: ChatMessage,
): ChatMessagesData => {
  const snapshot = data.pages[0];
  if (
    !snapshot ||
    snapshot.hasNewer ||
    snapshot.messages.some((candidate) => candidate.id === message.id)
  ) {
    return data;
  }
  return {
    ...data,
    pages: [{ ...snapshot, messages: [...snapshot.messages, message] }],
  };
};

export const updateMessageInPages = (
  data: ChatMessagesData,
  messageId: string,
  update: (message: ChatMessage) => ChatMessage,
): ChatMessagesData =>
  updateMessageSnapshot(data, (snapshot) =>
    snapshot.messages.some((message) => message.id === messageId)
      ? {
          ...snapshot,
          messages: snapshot.messages.map((message) =>
            message.id === messageId ? update(message) : message,
          ),
        }
      : snapshot,
  );

export const replaceMessageInPages = (
  data: ChatMessagesData,
  messageId: string,
  replacement: ChatMessage,
): ChatMessagesData => updateMessageInPages(data, messageId, () => replacement);

export const getMessageFromPages = (
  data: ChatMessagesData | undefined,
  messageId: string,
): ChatMessage | undefined =>
  data?.pages[0]?.messages.find((message) => message.id === messageId);

const optimisticMessageMutationMarker = Symbol("optimistic-message-mutation");

export type MessageMutationMarker = object;

type OptimisticMessage = ChatMessage & {
  [optimisticMessageMutationMarker]?: MessageMutationMarker;
};

/** Marks one optimistic row without adding serialisable driver state. */
export const markOptimisticMessageMutation = (
  message: ChatMessage,
  marker: MessageMutationMarker,
): ChatMessage =>
  ({
    ...message,
    [optimisticMessageMutationMarker]: marker,
  }) as OptimisticMessage;

/** A remote replacement creates a fresh object and therefore clears the mark. */
export const hasOptimisticMessageMutation = (
  message: ChatMessage,
  marker: MessageMutationMarker,
): boolean => getOptimisticMessageMutationMarker(message) === marker;

export const getOptimisticMessageMutationMarker = (
  message: ChatMessage,
): MessageMutationMarker | undefined =>
  (message as OptimisticMessage)[optimisticMessageMutationMarker];

export const removeMessageFromPages = (
  data: ChatMessagesData,
  messageId: string,
): ChatMessagesData =>
  updateMessageSnapshot(data, (snapshot) => {
    const removedIndex = snapshot.messages.findIndex(
      (message) => message.id === messageId,
    );
    if (removedIndex < 0) {
      return snapshot;
    }
    const readMarker = snapshot.readMarker;
    return {
      ...snapshot,
      messages: snapshot.messages.filter((message) => message.id !== messageId),
      readMarker:
        readMarker && removedIndex < readMarker.insertionIndex
          ? {
              ...readMarker,
              insertionIndex: readMarker.insertionIndex - 1,
            }
          : readMarker,
    };
  });

export const replaceRootMessageInPages = (
  data: ChatMessagesData,
  rootMessage: ChatMessage,
): ChatMessagesData => replaceMessageInPages(data, rootMessage.id, rootMessage);

export const patchRootThreadSummary = (
  data: ChatMessagesData,
  rootMessageId: string,
  thread: Pick<ChatThread, "id" | "replyCount" | "unreadCount">,
  optimisticMarker?: string,
): ChatMessagesData =>
  updateMessageSnapshot(data, (snapshot) =>
    snapshot.messages.some((message) => message.id === rootMessageId)
      ? {
          ...snapshot,
          messages: snapshot.messages.map((message) =>
            message.id === rootMessageId
              ? {
                  ...message,
                  thread: optimisticMarker
                    ? markOptimisticRootThreadSummary(
                        {
                          id: thread.id,
                          replyCount: thread.replyCount,
                          unreadCount: thread.unreadCount,
                        },
                        optimisticMarker,
                      )
                    : {
                        id: thread.id,
                        replyCount: thread.replyCount,
                        unreadCount: thread.unreadCount,
                      },
                }
              : message,
          ),
        }
      : snapshot,
  );

export const getRootThreadSummary = (
  data: ChatMessagesData | undefined,
  rootMessageId: string,
): ChatThreadSummary | undefined =>
  data?.pages[0]?.messages.find((message) => message.id === rootMessageId)
    ?.thread;

/**
 * Reverts only the summary carrying this mutation's non-serialised marker.
 * Object spreads preserve symbol keys, so unrelated unread/receipt patches can
 * safely clone it; a real driver update creates a fresh unmarked summary and
 * therefore wins over the rollback.
 */
export const rollbackOptimisticRootThreadSummary = (
  data: ChatMessagesData,
  rootMessageId: string,
  optimisticMarker: RootThreadSummaryMutationMarker,
  previousSummary: ChatThreadSummary | undefined,
): ChatMessagesData => {
  return updateMessageSnapshot(data, (snapshot) => {
    let changed = false;
    const messages = snapshot.messages.map((message) => {
      if (
        message.id !== rootMessageId ||
        !message.thread ||
        !hasOptimisticRootThreadSummaryMutation(
          message.thread,
          optimisticMarker,
        )
      ) {
        return message;
      }
      changed = true;
      return { ...message, thread: previousSummary };
    });
    return changed ? { ...snapshot, messages } : snapshot;
  });
};

/**
 * Merge a composition result without rolling back a newer remote reply that
 * may have reached the cache while the send request was in flight.
 */
export const mergeRootThreadSummary = (
  data: ChatMessagesData,
  rootMessageId: string,
  thread: Pick<ChatThread, "id" | "replyCount" | "unreadCount">,
): ChatMessagesData =>
  updateMessageSnapshot(data, (snapshot) =>
    snapshot.messages.some((message) => message.id === rootMessageId)
      ? {
          ...snapshot,
          messages: snapshot.messages.map((message) =>
            message.id === rootMessageId
              ? {
                  ...message,
                  thread: {
                    id: thread.id,
                    replyCount: Math.max(
                      message.thread?.replyCount ?? 0,
                      thread.replyCount,
                    ),
                    unreadCount: Math.max(
                      message.thread?.unreadCount ?? 0,
                      thread.unreadCount,
                    ),
                  },
                }
              : message,
          ),
        }
      : snapshot,
  );

export const appendThreadMessage = (
  detail: ChatThreadDetail,
  message: ChatMessage,
): ChatThreadDetail =>
  detail.messages.some((candidate) => candidate.id === message.id)
    ? detail
    : { ...detail, messages: [...detail.messages, message] };

export const updateThreadMessage = (
  detail: ChatThreadDetail,
  messageId: string,
  update: (message: ChatMessage) => ChatMessage,
): ChatThreadDetail => ({
  ...detail,
  messages: detail.messages.map((message) =>
    message.id === messageId ? update(message) : message,
  ),
});

export const replaceThreadMessage = (
  detail: ChatThreadDetail,
  messageId: string,
  replacement: ChatMessage,
): ChatThreadDetail =>
  updateThreadMessage(detail, messageId, () => replacement);

export const replaceOrAppendThreadMessage = (
  detail: ChatThreadDetail,
  messageId: string,
  replacement: ChatMessage,
): ChatThreadDetail =>
  detail.messages.some((message) => message.id === messageId)
    ? replaceThreadMessage(detail, messageId, replacement)
    : appendThreadMessage(detail, replacement);

export const removeThreadMessage = (
  detail: ChatThreadDetail,
  messageId: string,
): ChatThreadDetail => ({
  ...detail,
  messages: detail.messages.filter((message) => message.id !== messageId),
});

export const upsertThread = (
  threads: ChatThread[],
  thread: ChatThread,
): ChatThread[] => {
  const exists = threads.some((candidate) => candidate.id === thread.id);
  const next = exists
    ? threads.map((candidate) =>
        candidate.id === thread.id ? thread : candidate,
      )
    : [thread, ...threads];
  return next.sort((a, b) => b.lastReplyAt.localeCompare(a.lastReplyAt));
};

export const removeThread = (
  threads: ChatThread[],
  threadId: string,
): ChatThread[] => threads.filter((thread) => thread.id !== threadId);
