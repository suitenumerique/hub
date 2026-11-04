import { createContext, ReactNode, useContext } from "react";

export type EditingChatMessage = {
  id: string;
  content: string;
  /** Formatted body, where the composer finds the message's mentions back. */
  htmlContent?: string;
};

type ChatMessageEditContextValue = {
  startEditing: (message: EditingChatMessage) => void;
  /** Sends again a message that could not be sent. */
  retryFailedMessage: (id: string) => void;
  /** Drops a message that could not be sent. */
  discardFailedMessage: (id: string) => void;
};

const ChatMessageEditContext = createContext<ChatMessageEditContextValue>({
  startEditing: () => {},
  retryFailedMessage: () => {},
  discardFailedMessage: () => {},
});

export const ChatMessageEditProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: ChatMessageEditContextValue;
}) => (
  <ChatMessageEditContext.Provider value={value}>
    {children}
  </ChatMessageEditContext.Provider>
);

export const useChatMessageEdit = (): ChatMessageEditContextValue =>
  useContext(ChatMessageEditContext);
