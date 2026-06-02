import { ChatVirtualList } from "./ChatVirtualList";

type ChatConversationProps = {
  chatId: string;
};

export const ChatConversation = ({ chatId }: ChatConversationProps) => {
  return (
    <div className="hub__chat-conversation">
      <ChatVirtualList chatId={chatId} />
    </div>
  );
};
