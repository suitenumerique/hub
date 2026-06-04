import { createContext, useContext } from "react";

import type { ChatMessage, ChatMessageAuthor } from "@/features/drivers/types";

export type DraftThreadRoot = {
  message: ChatMessage;
  author?: ChatMessageAuthor;
};

export type OpenThreadOptions = {
  focusComposer?: boolean;
};

/**
 * Lets components deep in the conversation (message bubbles, the composer
 * banner) drive the tools panel without prop drilling. `ChatView` owns the
 * panel state and supplies the implementation.
 */
export type ChatPanelContextValue = {
  /** Opens the threads panel on a specific thread's detail view. */
  openThread: (threadId: string, options?: OpenThreadOptions) => void;
  /** Opens the threads panel on a message that does not have a thread yet. */
  openDraftThread: (root: DraftThreadRoot) => void;
  /** Opens the threads panel on the thread list. */
  openThreadList: () => void;
};

const noop = () => {};

const ChatPanelContext = createContext<ChatPanelContextValue>({
  openThread: noop,
  openDraftThread: noop,
  openThreadList: noop,
});

export const ChatPanelProvider = ChatPanelContext.Provider;

export const useChatPanel = (): ChatPanelContextValue =>
  useContext(ChatPanelContext);
