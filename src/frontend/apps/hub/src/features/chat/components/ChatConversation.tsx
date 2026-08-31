import type { ChatRef } from "@/features/drivers/types";

import {
  ChatVirtualList,
  type MainTimelineUnreadNavigation,
} from "./ChatVirtualList";

type ChatConversationProps = {
  chatRef: ChatRef;
  onUnreadNavigationChange?: (
    navigation: MainTimelineUnreadNavigation | null,
  ) => void;
};

export const ChatConversation = ({
  chatRef,
  onUnreadNavigationChange,
}: ChatConversationProps) => {
  return (
    <div className="hub__chat-conversation">
      <ChatVirtualList
        chatRef={chatRef}
        onUnreadNavigationChange={onUnreadNavigationChange}
      />
    </div>
  );
};
