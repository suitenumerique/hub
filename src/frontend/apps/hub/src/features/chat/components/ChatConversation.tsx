import { ChatComposer } from "./ChatComposer";
import { ChatVirtualList } from "./ChatVirtualList";

type ChatConversationProps = {
  chatId: string;
};

export const ChatConversation = ({ chatId }: ChatConversationProps) => (
  <div className="hub__chat-conversation">
    <ChatVirtualList chatId={chatId} />
    <div className="hub__chat-conversation__composer">
      <ChatComposer />
    </div>
  </div>
);
