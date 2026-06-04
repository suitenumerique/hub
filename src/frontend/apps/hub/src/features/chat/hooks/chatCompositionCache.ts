import type { InfiniteData } from "@tanstack/react-query";
import type { TFunction } from "i18next";

import type {
  ChatMessage,
  ChatMessagesPage,
  ChatThread,
  ChatThreadDetail,
} from "@/features/drivers/types";

export type ChatMessagesData = InfiniteData<ChatMessagesPage>;

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

export const appendMessageToNewestPage = (
  data: ChatMessagesData,
  message: ChatMessage,
): ChatMessagesData => {
  const [newest, ...rest] = data.pages;
  if (
    !newest ||
    newest.messages.some((candidate) => candidate.id === message.id)
  ) {
    return data;
  }
  return {
    ...data,
    pages: [{ ...newest, messages: [...newest.messages, message] }, ...rest],
  };
};

export const replaceMessageInPages = (
  data: ChatMessagesData,
  messageId: string,
  replacement: ChatMessage,
): ChatMessagesData => ({
  ...data,
  pages: data.pages.map((page) =>
    page.messages.some((message) => message.id === messageId)
      ? {
          ...page,
          messages: page.messages.map((message) =>
            message.id === messageId ? replacement : message,
          ),
        }
      : page,
  ),
});

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

export const appendThreadMessage = (
  detail: ChatThreadDetail,
  message: ChatMessage,
): ChatThreadDetail =>
  detail.messages.some((candidate) => candidate.id === message.id)
    ? detail
    : { ...detail, messages: [...detail.messages, message] };

export const replaceThreadMessage = (
  detail: ChatThreadDetail,
  messageId: string,
  replacement: ChatMessage,
): ChatThreadDetail => ({
  ...detail,
  messages: detail.messages.map((message) =>
    message.id === messageId ? replacement : message,
  ),
});

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
