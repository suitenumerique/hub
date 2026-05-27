import { useCallback } from "react";

import type {
  ChatMessageAuthor,
  ChatReaction,
} from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

import { formatChatTime } from "../formatTimestamp";
import { useToggleReaction } from "../hooks/useToggleReaction";

import { MessageHoverToolbar } from "./MessageHoverToolbar";
import { MessageReactions } from "./MessageReactions";

type ChatBubbleReceivedProps = {
  variant: "received";
  chatId: string;
  messageId: string;
  content: string;
  author: ChatMessageAuthor;
  timestamp: string;
  reactions: ChatReaction[];
  showHeader: boolean;
  showAvatar: boolean;
};

type ChatBubbleSentProps = {
  variant: "sent";
  chatId: string;
  messageId: string;
  content: string;
  timestamp: string;
  reactions: ChatReaction[];
  showTimestamp: boolean;
};

export type ChatBubbleProps = ChatBubbleReceivedProps | ChatBubbleSentProps;

export const ChatBubble = (props: ChatBubbleProps) => {
  const { chatId, messageId, reactions } = props;

  // Single integration point with the data layer: the hover toolbar and the
  // reactions bar both receive the bound `onReact` callback and stay purely
  // presentational. `messageId` is stable per row, so `onReact` is too.
  const { toggle } = useToggleReaction(chatId);
  const onReact = useCallback(
    (emoji: string) => toggle(messageId, emoji),
    [toggle, messageId],
  );

  if (props.variant === "sent") {
    return (
      <div className="hub__chat-bubble hub__chat-bubble--sent">
        <div className="hub__chat-bubble__body">
          {props.content}
          <MessageHoverToolbar onReact={onReact} />
        </div>
        <MessageReactions reactions={reactions} onReact={onReact} />
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
        <div className="hub__chat-bubble__body">
          {content}
          <MessageHoverToolbar onReact={onReact} />
        </div>
      </div>
      <MessageReactions reactions={reactions} onReact={onReact} />
    </div>
  );
};
