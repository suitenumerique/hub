import type { ChatMessageAuthor } from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

import { formatChatTime } from "../formatTimestamp";

type ChatBubbleReceivedProps = {
  variant: "received";
  content: string;
  author: ChatMessageAuthor;
  timestamp: string;
  showHeader: boolean;
  showAvatar: boolean;
};

type ChatBubbleSentProps = {
  variant: "sent";
  content: string;
  timestamp: string;
  showTimestamp: boolean;
};

export type ChatBubbleProps = ChatBubbleReceivedProps | ChatBubbleSentProps;

export const ChatBubble = (props: ChatBubbleProps) => {
  if (props.variant === "sent") {
    return (
      <div className="hub__chat-bubble hub__chat-bubble--sent">
        <div className="hub__chat-bubble__body">{props.content}</div>
        {props.showTimestamp && (
          <div className="hub__chat-bubble__timestamp">
            {formatChatTime(props.timestamp)}
          </div>
        )}
      </div>
    );
  }

  const { author, content, timestamp, showHeader, showAvatar } = props;

  return (
    <div className="hub__chat-bubble hub__chat-bubble--received">
      {showHeader && (
        <div className="hub__chat-bubble__header">
          <span className="hub__chat-bubble__author">{author.name}</span>
          <span className="hub__chat-bubble__header-dot" aria-hidden="true">
            •
          </span>
          <span className="hub__chat-bubble__timestamp">
            {formatChatTime(timestamp)}
          </span>
        </div>
      )}
      <div className="hub__chat-bubble__row">
        {showAvatar ? (
          <Avatar
            label={author.name}
            color={author.color}
            decorative
            size="sm"
          >
            {author.initials}
          </Avatar>
        ) : (
          <span className="hub__chat-bubble__avatar-spacer" aria-hidden="true" />
        )}
        <div className="hub__chat-bubble__body">{content}</div>
      </div>
    </div>
  );
};
