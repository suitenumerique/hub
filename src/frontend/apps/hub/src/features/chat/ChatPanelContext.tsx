import { createContext, useContext } from "react";

/**
 * Lets components deep in the conversation (message bubbles, the composer
 * banner) drive the tools panel without prop drilling. `ChatView` owns the
 * panel state and supplies the implementation.
 */
export type ChatPanelContextValue = {
  /** Opens the threads panel on a specific thread's detail view. */
  openThread: (threadId: string) => void;
  /** Opens the threads panel on the thread list. */
  openThreadList: () => void;
};

const noop = () => {};

const ChatPanelContext = createContext<ChatPanelContextValue>({
  openThread: noop,
  openThreadList: noop,
});

export const ChatPanelProvider = ChatPanelContext.Provider;

export const useChatPanel = (): ChatPanelContextValue =>
  useContext(ChatPanelContext);
