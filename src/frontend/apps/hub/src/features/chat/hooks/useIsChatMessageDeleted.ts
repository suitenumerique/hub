import type { InfiniteData } from "@tanstack/react-query";
import { useMemo } from "react";

import type {
  ChatMessagesPage,
  ChatRef,
  ChatThreadDetail,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

import { useCachedQueryData } from "./useCachedQueryData";

/**
 * Whether a loaded message was deleted, read from the messages already held
 * for the conversation or the thread it belongs to; nothing is fetched. A
 * message they do not hold, such as one still being sent, is not deleted.
 */
export const useIsChatMessageDeleted = (
  chatRef: ChatRef,
  threadId: string | undefined,
  messageId: string,
): boolean => {
  const data = useCachedQueryData<
    InfiniteData<ChatMessagesPage> | ChatThreadDetail
  >(threadId ? chatKeys.thread(chatRef, threadId) : chatKeys.messages(chatRef));

  return useMemo(() => {
    if (!data) {
      return false;
    }
    const messages =
      "pages" in data
        ? data.pages.flatMap((page) => page.messages)
        : data.messages;
    return messages.some(
      (message) => message.id === messageId && message.isDeleted,
    );
  }, [data, messageId]);
};
