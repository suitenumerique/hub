import { createContext, ReactNode, useContext } from "react";

export type EditingChatMessage = {
  id: string;
  content: string;
};

type ChatMessageEditContextValue = {
  startEditing: (message: EditingChatMessage) => void;
};

const ChatMessageEditContext = createContext<ChatMessageEditContextValue>({
  startEditing: () => {},
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
