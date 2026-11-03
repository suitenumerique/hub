import { type InfiniteData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatMessagesPage,
  ChatRef,
  ChatThreadDetail,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import { useCachedQueryData } from "./useCachedQueryData";

export type UseQuotedChatMessageResult = {
  message: ChatMessage | undefined;
  /** Who sent it. Held pages name no author for the current user. */
  author: ChatMessageAuthor | undefined;
  /** Whether the conversation or the thread already holds the message. */
  isHeld: boolean;
  /** Thread the message is a reply in; `undefined` in the main timeline. */
  threadId: string | undefined;
  isLoading: boolean;
  /** The quoted message could not be loaded. */
  isError: boolean;
};

/**
 * The message a reply quotes. Read from the messages already held for the
 * conversation or the reply's thread, so it shows at once and follows their
 * updates; fetched through the driver only when they do not hold it.
 */
export const useQuotedChatMessage = (
  chatRef: ChatRef,
  threadId: string | undefined,
  messageId: string,
): UseQuotedChatMessageResult => {
  const data = useCachedQueryData<
    InfiniteData<ChatMessagesPage> | ChatThreadDetail
  >(threadId ? chatKeys.thread(chatRef, threadId) : chatKeys.messages(chatRef));

  const held = useMemo(() => {
    if (!data) {
      return undefined;
    }
    const pages = "pages" in data ? data.pages : [data];
    const message = pages
      .flatMap((page) => page.messages)
      .find((candidate) => candidate.id === messageId);
    if (!message) {
      return undefined;
    }
    const author = pages
      .flatMap((page) => page.authors)
      .find((candidate) => candidate.id === message.authorId);
    return author || message.authorId === "me"
      ? { message, author }
      : undefined;
  }, [data, messageId]);

  const query = useQuery({
    queryKey: chatKeys.quotedMessage(chatRef, messageId),
    queryFn: () =>
      getRegistry()
        .get(chatRef.accountId)
        .getQuotedChatMessage({ chatId: chatRef.chatId, messageId }),
    enabled: !held,
    staleTime: Infinity,
    // The quoted message may be gone or out of reach for good.
    retry: false,
    meta: { noGlobalError: true },
  });

  if (held) {
    // Held by the list the reply is in: in the same thread, or none.
    return {
      ...held,
      isHeld: true,
      threadId,
      isLoading: false,
      isError: false,
    };
  }
  return {
    message: query.data?.message,
    author: query.data?.author,
    isHeld: false,
    threadId: query.data?.threadId,
    isLoading: query.isPending,
    isError: query.isError,
  };
};
