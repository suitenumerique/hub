import type { Chat, ChatRef } from "@/features/drivers/types";

import { ChatVirtualList } from "./ChatVirtualList";

type ChatConversationProps = {
  chatRef: ChatRef;
  chat: Chat | null;
};

export const ChatConversation = ({ chatRef, chat }: ChatConversationProps) => {
  return (
    <div className="hub__chat-conversation">
      <ChatVirtualList chatRef={chatRef} chat={chat} />
    </div>
  );
};
