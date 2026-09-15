import {
  createContext,
  type RefObject,
  useContext,
  useLayoutEffect,
} from "react";

import type { ChatRef } from "@/features/drivers/types";

const ActiveChatContext = createContext<RefObject<ChatRef | null> | null>(null);

export const ActiveChatProvider = ActiveChatContext.Provider;

/** Publish the displayed conversation, including one resolved on `/chat/new`. */
export const useReportActiveChat = (chatRef: ChatRef | null): void => {
  const activeChatRef = useContext(ActiveChatContext);
  const accountId = chatRef?.accountId;
  const chatId = chatRef?.chatId;

  useLayoutEffect(() => {
    if (!activeChatRef) return;
    const displayedChat =
      accountId !== undefined && chatId !== undefined
        ? { accountId, chatId }
        : null;
    activeChatRef.current = displayedChat;
    return () => {
      if (activeChatRef.current === displayedChat) {
        activeChatRef.current = null;
      }
    };
  }, [activeChatRef, accountId, chatId]);
};
