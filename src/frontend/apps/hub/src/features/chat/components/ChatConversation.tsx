import type { ChatRef } from "@/features/drivers/types";

import { ChatVirtualList } from "./ChatVirtualList";
import type { UnreadMessagesBannerProps } from "./UnreadMessagesBanner";

type ChatConversationProps = {
  chatRef: ChatRef;
  onUnreadBannerChange: (
    chatKey: string,
    banner: UnreadMessagesBannerProps | null,
  ) => void;
};

export const ChatConversation = ({
  chatRef,
  onUnreadBannerChange,
}: ChatConversationProps) => {
  return (
    <div className="hub__chat-conversation">
      <ChatVirtualList
        chatRef={chatRef}
        onUnreadBannerChange={onUnreadBannerChange}
      />
    </div>
  );
};
