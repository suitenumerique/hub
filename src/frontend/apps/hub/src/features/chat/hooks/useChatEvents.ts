import {
  type InfiniteData,
  type QueryClient,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

import { chatKeys } from "@/features/chat/chatKeys";
import { isReactionTogglePending } from "@/features/chat/pendingReactionToggles";
import { keepReactionOrder } from "@/features/chat/reactions";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { ChatEvent } from "@/features/drivers/Driver";
import type {
  AccountId,
  ChatRef,
  ChatMessage,
  ChatMessagesPage,
  ChatThreadDetail,
  ChatUnread,
} from "@/features/drivers/types";

type ChatMessagesData = InfiniteData<ChatMessagesPage>;

type ScopedChatEvent = {
  accountId: AccountId;
  event: ChatEvent;
};

type MessageNewEvent = Extract<ChatEvent, { type: "message:new" }>;

/**
 * Appends a freshly-received message to the newest page of the infinite-query
 * cache (page 0 holds the latest range; messages within a page are ASC). A
 * no-op when the cache is cold or the message is already present.
 *
 * Messages come in the order sync delivers them, as Element shows them and as
 * a reload reads them: a timestamp from a lagging homeserver may be older than
 * the messages already shown, and must neither drop nor move the message.
 */
const appendMessage = (
  data: ChatMessagesData,
  event: MessageNewEvent,
): ChatMessagesData => {
  const [newest, ...rest] = data.pages;
  // A contextual cache intentionally ends before the live timeline. Appending
  // a live event there would create an artificial gap and corrupt its cursors.
  if (
    !newest ||
    newest.isAtLiveEnd === false ||
    data.pages.some((page) =>
      page.messages.some((m) => m.id === event.message.id),
    )
  ) {
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

/**
 * A fresh copy of a cached message. Its reaction chips keep their order, and
 * stay as they are while this session's toggle on them is in flight.
 */
const withCachedReactions = (
  ref: ChatRef,
  cached: ChatMessage,
  next: ChatMessage,
): ChatMessage => ({
  ...next,
  reactions: isReactionTogglePending(ref, next.id)
    ? cached.reactions
    : keepReactionOrder(cached.reactions, next.reactions),
});

/**
 * Applies a patch to a cache now and, when a load of that cache is in flight,
 * once more after it lands: the load read the data before this patch and
 * replaces the cache with it. Element avoids this by re-reading its timeline
 * window for every event. Patches are idempotent, so applying twice is safe.
 */
export const patchAcrossLoads = (
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  patch: () => void,
): void => {
  patch();
  const patchAfterLoad = () => {
    const query = queryClient.getQueryCache().find({ queryKey, exact: true });
    if (query?.state.fetchStatus !== "fetching") {
      return false;
    }
    const again = () => {
      if (!patchAfterLoad()) patch();
    };
    void query.promise?.then(again, again);
    return true;
  };
  patchAfterLoad();
};

/**
 * Live messages of the last minute, per conversation. A window loaded outside
 * React Query (around an unread message, see `useChatMessages`) replaces the
 * cache wholesale: it re-applies them so that none read too early is lost.
 */
const RECENT_LIVE_MESSAGES_MS = 60_000;
const recentLiveMessages = new Map<
  string,
  Array<{ event: MessageNewEvent; receivedAt: number }>
>();

const chatKeyOf = (ref: ChatRef): string =>
  `${ref.accountId}\u0000${ref.chatId}`;

const recentLiveMessagesOf = (ref: ChatRef) => {
  const now = Date.now();
  const recent = (recentLiveMessages.get(chatKeyOf(ref)) ?? []).filter(
    ({ receivedAt }) => now - receivedAt < RECENT_LIVE_MESSAGES_MS,
  );
  recentLiveMessages.set(chatKeyOf(ref), recent);
  return recent;
};

const rememberLiveMessage = (ref: ChatRef, event: MessageNewEvent): void => {
  recentLiveMessagesOf(ref).push({ event, receivedAt: Date.now() });
};

const forgetLiveMessage = (ref: ChatRef, messageId: string): void => {
  recentLiveMessages.set(
    chatKeyOf(ref),
    recentLiveMessagesOf(ref).filter(
      ({ event }) => event.message.id !== messageId,
    ),
  );
};

/** Appends again the recent live messages missing from a reloaded window. */
export const replayRecentLiveMessages = (
  queryClient: QueryClient,
  ref: ChatRef,
): void => {
  const recent = recentLiveMessagesOf(ref);
  if (recent.length === 0) {
    return;
  }
  queryClient.setQueryData<ChatMessagesData>(chatKeys.messages(ref), (data) =>
    data
      ? recent.reduce(
          (current, { event }) => appendMessage(current, event),
          data,
        )
      : data,
  );
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
    case "message:reconciled": {
      // Decryption updates an existing placeholder, not a new delivery. A null
      // message removes it when the clear event turns out to be a reply or edit.
      if (!event.message) forgetLiveMessage(ref, event.messageId);
      const messagesKey = chatKeys.messages(ref);
      patchAcrossLoads(queryClient, messagesKey, () =>
        queryClient.setQueryData<ChatMessagesData>(messagesKey, (data) => {
          if (!data) return data;
          const reconciled = event.message;
          return reconciled
            ? replaceMessage(data, event.messageId, (cached) =>
                withCachedReactions(ref, cached, reconciled),
              )
            : {
                ...data,
                pages: data.pages.map((page) => ({
                  ...page,
                  messages: page.messages.filter(
                    (message) => message.id !== event.messageId,
                  ),
                })),
              };
        }),
      );
      // The driver batches list refreshes separately from these per-event patches.
      return;
    }
    case "message:new": {
      rememberLiveMessage(ref, event);
      const messagesKey = chatKeys.messages(ref);
      // A load in flight (the first page included, which has no data yet to
      // append to) may have read the timeline before this message.
      patchAcrossLoads(queryClient, messagesKey, () =>
        queryClient.setQueryData<ChatMessagesData>(messagesKey, (data) =>
          data ? appendMessage(data, event) : data,
        ),
      );
      // Touches list ordering / last activity. Read state has its own slice.
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
      return;
    }

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

    case "main-timeline-unread:changed":
      void queryClient.invalidateQueries({
        queryKey: chatKeys.mainTimelineUnread(ref),
      });
      return;

    case "message:updated": {
      const messagesKey = chatKeys.messages(ref);
      patchAcrossLoads(queryClient, messagesKey, () =>
        queryClient.setQueryData<ChatMessagesData>(messagesKey, (data) =>
          data && (!event.threadId || event.message.id === event.threadId)
            ? replaceMessage(data, event.message.id, (cached) =>
                withCachedReactions(ref, cached, event.message),
              )
            : data,
        ),
      );
      if (event.threadId) {
        const threadKey = chatKeys.thread(ref, event.threadId);
        patchAcrossLoads(queryClient, threadKey, () =>
          queryClient.setQueryData<ChatThreadDetail>(threadKey, (detail) =>
            detail
              ? {
                  ...detail,
                  messages: detail.messages.map((message) =>
                    message.id === event.message.id
                      ? withCachedReactions(ref, message, event.message)
                      : message,
                  ),
                }
              : detail,
          ),
        );
      }
      return;
    }

    case "reaction:updated": {
      // This session's toggle in flight owns the chips until the driver
      // answers, which publishes the reactions it ends with.
      if (isReactionTogglePending(ref, event.messageId)) {
        return;
      }
      if (event.threadId) {
        const threadKey = chatKeys.thread(ref, event.threadId);
        patchAcrossLoads(queryClient, threadKey, () =>
          queryClient.setQueryData<ChatThreadDetail>(threadKey, (detail) =>
            detail
              ? {
                  ...detail,
                  messages: detail.messages.map((m) =>
                    m.id === event.messageId
                      ? {
                          ...m,
                          reactions: keepReactionOrder(
                            m.reactions,
                            event.reactions,
                          ),
                        }
                      : m,
                  ),
                }
              : detail,
          ),
        );
        return;
      }
      const messagesKey = chatKeys.messages(ref);
      patchAcrossLoads(queryClient, messagesKey, () =>
        queryClient.setQueryData<ChatMessagesData>(messagesKey, (data) =>
          data
            ? replaceMessage(data, event.messageId, (m) => ({
                ...m,
                reactions: keepReactionOrder(m.reactions, event.reactions),
              }))
            : data,
        ),
      );
      return;
    }

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

    case "members:changed":
      void queryClient.invalidateQueries({
        queryKey: chatKeys.members(ref),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chat(ref) });
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
      return;

    case "tags:changed":
      void queryClient.invalidateQueries({ queryKey: chatKeys.chat(ref) });
      void queryClient.invalidateQueries({
        queryKey: chatKeys.chatsOf(accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
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
