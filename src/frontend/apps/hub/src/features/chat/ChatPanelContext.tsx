import { createContext, useContext } from "react";

import type { ChatMessage, ChatMessageAuthor } from "@/features/drivers/types";

export type DraftThreadRoot = {
  message: ChatMessage;
  author?: ChatMessageAuthor;
};

export type OpenThreadOptions = {
  focusComposer?: boolean;
  /**
   * A reply of the thread to show highlighted, as Element's ShowThread
   * `initialEvent`: a quote of it outside the thread was clicked.
   */
  messageId?: string;
};

/** The reply a thread view opens on, a new one for every opening. */
export type ThreadInitialMessage = { messageId: string };

/**
 * Lets components deep in the conversation (message bubbles, the composer
 * banner) drive the tools panel, and the panel's components the conversation,
 * without prop drilling. `ChatView` owns the panel state and supplies the
 * implementation.
 */
export type ChatPanelContextValue = {
  /** Opens the threads panel on a specific thread's detail view. */
  openThread: (threadId: string, options?: OpenThreadOptions) => void;
  /** Opens the threads panel on a message that does not have a thread yet. */
  openDraftThread: (root: DraftThreadRoot) => void;
  /** Opens the threads panel on the thread list. */
  openThreadList: () => void;
  /**
   * Goes to a message of the conversation from a thread quoting it, as
   * Element moves its timeline while the thread stays open.
   */
  jumpToConversationMessage: (messageId: string) => Promise<void>;
};

const noop = () => {};

const ChatPanelContext = createContext<ChatPanelContextValue>({
  openThread: noop,
  openDraftThread: noop,
  openThreadList: noop,
  jumpToConversationMessage: async () => {},
});

export const ChatPanelProvider = ChatPanelContext.Provider;

export const useChatPanel = (): ChatPanelContextValue =>
  useContext(ChatPanelContext);
