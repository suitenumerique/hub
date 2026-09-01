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
  ChatMessageWindow,
  ChatThreadDetail,
  ChatUnread,
} from "@/features/drivers/types";

import { bumpChatMessageEventVersion } from "./chatCompositionCache";

type ChatMessagesData = InfiniteData<ChatMessageWindow>;

type ScopedChatEvent = {
  accountId: AccountId;
  event: ChatEvent;
};

/**
 * Appends a freshly-received message to the single infinite-query snapshot.
 * A contextual window is updated only after it has reached the live end;
 * otherwise inserting the event would create a gap.
 */
const appendMessage = (
  data: ChatMessagesData,
  event: Extract<ChatEvent, { type: "message:new" }>,
): ChatMessagesData => {
  const snapshot = data.pages[0];
  if (
    !snapshot ||
    snapshot.hasNewer ||
    snapshot.messages.some((m) => m.id === event.message.id)
  ) {
    return data;
  }
  const authors = event.authors
    ? [
        ...snapshot.authors,
        ...event.authors.filter(
          (a) => !snapshot.authors.some((existing) => existing.id === a.id),
        ),
      ]
    : snapshot.authors;
  return {
    ...data,
    pages: [
      {
        ...snapshot,
        authors,
        messages: [...snapshot.messages, event.message],
      },
    ],
  };
};

/**
 * Applies a main-timeline patch to the conversation's current window snapshot.
 */
const updateMessageWindows = (
  queryClient: QueryClient,
  ref: ChatRef,
  update: (data: ChatMessagesData) => ChatMessagesData,
): void => {
  queryClient.setQueryData<ChatMessagesData>(chatKeys.messages(ref), (data) =>
    data ? update(data) : data,
  );
};

/** Replaces a message in the cached snapshot with a fresh object (so the
 * memoized virtual-list row re-renders). */
const replaceMessage = (
  data: ChatMessagesData,
  messageId: string,
  update: (
    m: ChatMessageWindow["messages"][number],
  ) => ChatMessageWindow["messages"][number],
): ChatMessagesData => {
  const snapshot = data.pages[0];
  if (!snapshot || !snapshot.messages.some((m) => m.id === messageId)) {
    return data;
  }
  return {
    ...data,
    pages: [
      {
        ...snapshot,
        messages: snapshot.messages.map((m) =>
          m.id === messageId ? update(m) : m,
        ),
      },
    ],
  };
};

/** Removes a thread reply which the SDK moved onto the room timeline after its
 * redaction stripped the `m.thread` relation. */
const removeMessage = (
  data: ChatMessagesData,
  messageId: string,
): ChatMessagesData => {
  const snapshot = data.pages[0];
  if (
    !snapshot ||
    !snapshot.messages.some((message) => message.id === messageId)
  ) {
    return data;
  }
  const removedIndex = snapshot.messages.findIndex(
    (message) => message.id === messageId,
  );
  const readMarker = snapshot.readMarker;
  return {
    ...data,
    pages: [
      {
        ...snapshot,
        messages: snapshot.messages.filter(
          (message) => message.id !== messageId,
        ),
        readMarker:
          readMarker && removedIndex < readMarker.insertionIndex
            ? {
                ...readMarker,
                insertionIndex: readMarker.insertionIndex - 1,
              }
            : readMarker,
      },
    ],
  };
};

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
      bumpChatMessageEventVersion(ref);
      updateMessageWindows(queryClient, ref, (data) =>
        appendMessage(data, event),
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
            previous.highlight === event.unread.highlight &&
            previous.mainTimelineReadMarkerId ===
              event.unread.mainTimelineReadMarkerId
          ) {
            return current;
          }
          return { ...(current ?? {}), [event.chatId]: event.unread };
        },
      );
      return;

    case "message:updated":
      bumpChatMessageEventVersion(ref);
      updateMessageWindows(queryClient, ref, (data) =>
        event.threadId && event.message.id !== event.threadId
          ? removeMessage(data, event.message.id)
          : replaceMessage(data, event.message.id, () => event.message),
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
      bumpChatMessageEventVersion(ref);
      updateMessageWindows(queryClient, ref, (data) =>
        replaceMessage(data, event.messageId, (m) => ({
          ...m,
          reactions: event.reactions,
        })),
      );
      return;

    case "chat:changed":
      // Fine-grained timeline events patch the active window above. Reopening
      // the query here would call `openChatMessageWindow` and silently replace
      // a contextual unread view with the live end on unrelated room state.
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
