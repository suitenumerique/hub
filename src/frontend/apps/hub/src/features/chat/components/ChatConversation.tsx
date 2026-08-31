import type { ChatRef } from "@/features/drivers/types";

import {
  ChatVirtualList,
  type MainTimelineUnreadNavigationUpdate,
} from "./ChatVirtualList";

type ChatConversationProps = {
  chatRef: ChatRef;
  onUnreadNavigationChange?: (
    update: MainTimelineUnreadNavigationUpdate,
  ) => void;
};

export const ChatConversation = ({
  chatRef,
  onUnreadNavigationChange,
}: ChatConversationProps) => {
  return (
    <div className="hub__chat-conversation">
      <ChatVirtualList
        key={`${chatRef.accountId}:${chatRef.chatId}`}
        chatRef={chatRef}
        onUnreadNavigationChange={onUnreadNavigationChange}
      />
    </div>
  );
};
