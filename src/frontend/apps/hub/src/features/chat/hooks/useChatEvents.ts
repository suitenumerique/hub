import {
  type InfiniteData,
  type QueryClient,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

import { chatKeys } from "@/features/chat/chatKeys";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { ChatEvent } from "@/features/drivers/Driver";
import type {
  AccountId,
  ChatRef,
  ChatMessagesPage,
  ChatThreadDetail,
  ChatUnread,
} from "@/features/drivers/types";

type ChatMessagesData = InfiniteData<ChatMessagesPage>;

type ScopedChatEvent = {
  accountId: AccountId;
  event: ChatEvent;
};

/**
 * Appends a freshly-received message to the newest page of the infinite-query
 * cache (page 0 holds the latest range; messages within a page are ASC). A
 * no-op when the cache is cold or the message is already present.
 */
const appendMessage = (
  data: ChatMessagesData,
  event: Extract<ChatEvent, { type: "message:new" }>,
): ChatMessagesData => {
  const [newest, ...rest] = data.pages;
  if (!newest || newest.messages.some((m) => m.id === event.message.id)) {
    return data;
  }
  const authors = event.authors
    ? [
        ...newest.authors,
        ...event.authors.filter(
          (a) => !newest.authors.some((existing) => existing.id === a.id),
        ),
      ]
    : newest.authors;
  return {
    ...data,
    pages: [
      { ...newest, authors, messages: [...newest.messages, event.message] },
      ...rest,
    ],
  };
};

/** Replaces a message across every loaded page with a fresh object (so the
 * memoized virtual-list row re-renders). No-op for pages without it. */
const replaceMessage = (
  data: ChatMessagesData,
  messageId: string,
  update: (
    m: ChatMessagesPage["messages"][number],
  ) => ChatMessagesPage["messages"][number],
): ChatMessagesData => ({
  ...data,
  pages: data.pages.map((page) =>
    page.messages.some((m) => m.id === messageId)
      ? {
          ...page,
          messages: page.messages.map((m) =>
            m.id === messageId ? update(m) : m,
          ),
        }
      : page,
  ),
});

/** Removes a thread reply which the SDK moved onto the room timeline after its
 * redaction stripped the `m.thread` relation. */
const removeMessage = (
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

/**
 * Translates a single backend event into a React Query cache operation. Events
 * that carry a payload are **patched** directly (no refetch); coarse events are
 * **invalidated** so the affected hook refetches through the driver. This is
 * the one place that knows the cache shapes; the driver stays React-free.
 */
const applyChatEvent = (
  queryClient: QueryClient,
  { accountId, event }: ScopedChatEvent,
): void => {
  const ref: ChatRef =
    "chatId" in event
      ? { accountId, chatId: event.chatId }
      : {
          accountId,
          chatId: "",
        };

  switch (event.type) {
    case "message:new":
      queryClient.setQueryData<ChatMessagesData>(
        chatKeys.messages(ref),
        (data) => (data ? appendMessage(data, event) : data),
      );
      // Touches list ordering / last activity. Read state has its own slice.
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
      return;

    case "unread:changed":
      queryClient.setQueryData<Record<string, ChatUnread>>(
        chatKeys.unreadOf(accountId),
        (current) => {
          const previous = current?.[event.chatId];
          if (
            previous?.unread === event.unread.unread &&
            previous.highlight === event.unread.highlight
          ) {
            return current;
          }
          return { ...(current ?? {}), [event.chatId]: event.unread };
        },
      );
      return;

    case "message:updated":
      queryClient.setQueryData<ChatMessagesData>(
        chatKeys.messages(ref),
        (data) =>
          data
            ? event.threadId && event.message.id !== event.threadId
              ? removeMessage(data, event.message.id)
              : replaceMessage(data, event.message.id, () => event.message)
            : data,
      );
      if (event.threadId) {
        queryClient.setQueryData<ChatThreadDetail>(
          chatKeys.thread(ref, event.threadId),
          (detail) =>
            detail
              ? {
                  ...detail,
                  messages: detail.messages.map((message) =>
                    message.id === event.message.id ? event.message : message,
                  ),
                }
              : detail,
        );
      }
      return;

    case "reaction:updated":
      if (event.threadId) {
        queryClient.setQueryData<ChatThreadDetail>(
          chatKeys.thread(ref, event.threadId),
          (detail) =>
            detail
              ? {
                  ...detail,
                  messages: detail.messages.map((m) =>
                    m.id === event.messageId
                      ? { ...m, reactions: event.reactions }
                      : m,
                  ),
                }
              : detail,
        );
        return;
      }
      queryClient.setQueryData<ChatMessagesData>(
        chatKeys.messages(ref),
        (data) =>
          data
            ? replaceMessage(data, event.messageId, (m) => ({
                ...m,
                reactions: event.reactions,
              }))
            : data,
      );
      return;

    case "chat:changed":
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(ref) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chat(ref) });
      return;

    case "threads:changed":
      void queryClient.invalidateQueries({
        queryKey: chatKeys.threads(ref),
      });
      if (event.invalidateDetails !== false) {
        void queryClient.invalidateQueries({
          queryKey: chatKeys.threadDetails(ref),
        });
      }
      return;

    case "documents:changed":
      void queryClient.invalidateQueries({
        queryKey: chatKeys.documents(ref),
      });
      return;

    case "chats:changed":
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
      // The room list changed, so a New Chat participant-set resolution may now
      // hit (or stop hitting) an existing conversation. Its cache is a separate
      // staleTime:Infinity slice, so it only re-runs when explicitly invalidated.
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatForUsersOf(accountId),
      });
      return;
  }
};

/**
 * Global real-time bridge. Subscribes ONCE to the active driver's app-wide
 * event stream (Matrix `/sync`, SSE, WebSocket…) and reflects every event into
 * the React Query cache — patching when the event carries data, invalidating
 * otherwise. Mounted in the messaging shell (`HubLayout`), not per conversation,
 * so activity in chats that are not open (unread badges, the conversation list,
 * invitations) is still reflected. A no-op for drivers without real-time.
 */
export const useChatEvents = (): void => {
  const entries = useDriverEntries();
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribes = entries.map(({ accountId, driver }) =>
      driver.subscribeToEvents((event) =>
        applyChatEvent(queryClient, { accountId, event }),
      ),
    );
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [entries, queryClient]);
};
