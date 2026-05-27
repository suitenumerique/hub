import { useChatThreads } from "../hooks/useChatThreads";

import { ChatComposer } from "./ChatComposer";
import { ChatVirtualList } from "./ChatVirtualList";
import { UnreadThreadsBanner } from "./UnreadThreadsBanner";

type ChatConversationProps = {
  chatId: string;
};

export const ChatConversation = ({ chatId }: ChatConversationProps) => {
  const { unreadThreads } = useChatThreads(chatId);

  return (
    <div className="hub__chat-conversation">
      <ChatVirtualList chatId={chatId} />
      <div className="hub__chat-conversation__composer">
        {unreadThreads.length > 0 ? (
          <div className="hub__chat-composer-stack">
            <UnreadThreadsBanner
              chatId={chatId}
              unreadThreads={unreadThreads}
            />
            <ChatComposer />
          </div>
        ) : (
          <ChatComposer />
        )}
      </div>
    </div>
  );
};
