import type { InfiniteData } from "@tanstack/react-query";
import type { TFunction } from "i18next";

import type {
  ChatMessage,
  ChatMessageWindow,
  ChatThread,
  ChatThreadDetail,
  ChatThreadSummary,
} from "@/features/drivers/types";

export type ChatMessagesData = InfiniteData<ChatMessageWindow>;

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
  };
};

/** Appends to the permanent live cache, whose page 0 is the live end. */
export const appendMessageToNewestPage = (
  data: ChatMessagesData,
  message: ChatMessage,
): ChatMessagesData => {
  const [newest, ...rest] = data.pages;
  const hasUnloadedNewerMessages = Boolean(newest?.newerCursor);
  if (
    !newest ||
    hasUnloadedNewerMessages ||
    newest.messages.some((candidate) => candidate.id === message.id)
  ) {
    return data;
  }
  return {
    ...data,
    pages: [{ ...newest, messages: [...newest.messages, message] }, ...rest],
  };
};

export const updateMessageInPages = (
  data: ChatMessagesData,
  messageId: string,
  update: (message: ChatMessage) => ChatMessage,
): ChatMessagesData => ({
  ...data,
  pages: data.pages.map((page) =>
    page.messages.some((message) => message.id === messageId)
      ? {
          ...page,
          messages: page.messages.map((message) =>
            message.id === messageId ? update(message) : message,
          ),
        }
      : page,
  ),
});

export const replaceMessageInPages = (
  data: ChatMessagesData,
  messageId: string,
  replacement: ChatMessage,
): ChatMessagesData => updateMessageInPages(data, messageId, () => replacement);

export const getMessageFromPages = (
  data: ChatMessagesData | undefined,
  messageId: string,
): ChatMessage | undefined =>
  data?.pages
    .flatMap((page) => page.messages)
    .find((message) => message.id === messageId);

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
): ChatMessagesData => ({
  ...data,
  pages: data.pages.map((page) =>
    page.messages.some((message) => message.id === messageId)
      ? {
          ...page,
          messages: page.messages.filter((message) => message.id !== messageId),
        }
      : page,
  ),
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
): ChatMessagesData => ({
  ...data,
  pages: data.pages.map((page) =>
    page.messages.some((message) => message.id === rootMessageId)
      ? {
          ...page,
          messages: page.messages.map((message) =>
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
      : page,
  ),
});

export const getRootThreadSummary = (
  data: ChatMessagesData | undefined,
  rootMessageId: string,
): ChatThreadSummary | undefined =>
  data?.pages
    .flatMap((page) => page.messages)
    .find((message) => message.id === rootMessageId)?.thread;

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
  let changed = false;
  const pages = data.pages.map((page) => {
    const messages = page.messages.map((message) => {
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
    return messages.some((message, index) => message !== page.messages[index])
      ? { ...page, messages }
      : page;
  });
  return changed ? { ...data, pages } : data;
};

/**
 * Merge a composition result without rolling back a newer remote reply that
 * may have reached the cache while the send request was in flight.
 */
export const mergeRootThreadSummary = (
  data: ChatMessagesData,
  rootMessageId: string,
  thread: Pick<ChatThread, "id" | "replyCount" | "unreadCount">,
): ChatMessagesData => ({
  ...data,
  pages: data.pages.map((page) =>
    page.messages.some((message) => message.id === rootMessageId)
      ? {
          ...page,
          messages: page.messages.map((message) =>
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
      : page,
  ),
});

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
