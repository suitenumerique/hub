import type { ChatRef } from "@/features/drivers/types";

import { ChatVirtualList } from "./ChatVirtualList";

type ChatConversationProps = {
  chatRef: ChatRef;
};

export const ChatConversation = ({ chatRef }: ChatConversationProps) => {
  return (
    <div className="hub__chat-conversation">
      <ChatVirtualList chatRef={chatRef} />
    </div>
  );
};
