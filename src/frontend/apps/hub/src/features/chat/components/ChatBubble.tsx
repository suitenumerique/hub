import { useCallback } from "react";

import type {
  ChatMessageAuthor,
  ChatReaction,
  ChatThreadSummary,
} from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

import { useChatPanel } from "../ChatPanelContext";
import { formatChatTime } from "../formatTimestamp";
import { useToggleReaction } from "../hooks/useToggleReaction";

import { MessageHoverToolbar } from "./MessageHoverToolbar";
import { MessageReactions } from "./MessageReactions";
import { ThreadButton } from "./ThreadButton";

type ChatBubbleReceivedProps = {
  variant: "received";
  chatId: string;
  messageId: string;
  content: string;
  author: ChatMessageAuthor;
  timestamp: string;
  reactions: ChatReaction[];
  /** Thread opened from this message, if any. */
  thread?: ChatThreadSummary;
  /** Set when this bubble is rendered inside a thread's detail view. */
  threadId?: string;
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
  /** Thread opened from this message, if any. */
  thread?: ChatThreadSummary;
  /** Set when this bubble is rendered inside a thread's detail view. */
  threadId?: string;
  showTimestamp: boolean;
};

export type ChatBubbleProps = ChatBubbleReceivedProps | ChatBubbleSentProps;

/**
 * The thread button and the reactions bar share one wrapping row below the
 * bubble; the thread button comes first and the row wraps when the two no
 * longer fit side by side.
 */
type ChatBubbleFooterProps = {
  thread: ChatThreadSummary | undefined;
  reactions: ChatReaction[];
  onReact: (emoji: string) => void;
};

const ChatBubbleFooter = ({
  thread,
  reactions,
  onReact,
}: ChatBubbleFooterProps) => {
  const { openThread } = useChatPanel();

  if (!thread && reactions.length === 0) {
    return null;
  }

  return (
    <div className="hub__chat-bubble__footer">
      {thread && (
        <ThreadButton summary={thread} onOpen={() => openThread(thread.id)} />
      )}
      <MessageReactions reactions={reactions} onReact={onReact} />
    </div>
  );
};

export const ChatBubble = (props: ChatBubbleProps) => {
  const { chatId, messageId, reactions, thread, threadId } = props;

  // Single integration point with the data layer: the hover toolbar and the
  // reactions bar both receive the bound `onReact` callback and stay purely
  // presentational. `messageId` is stable per row, so `onReact` is too. Passing
  // `threadId` routes the toggle to the thread cache when inside a thread.
  const { toggle } = useToggleReaction(chatId, threadId);
  const onReact = useCallback(
    (emoji: string) => toggle(messageId, emoji),
    [toggle, messageId],
  );
  // Inside a thread the toolbar drops the Reply / More actions.
  const compactToolbar = threadId !== undefined;

  if (props.variant === "sent") {
    return (
      <div className="hub__chat-bubble hub__chat-bubble--sent">
        <div className="hub__chat-bubble__body">
          {props.content}
          <MessageHoverToolbar onReact={onReact} compact={compactToolbar} />
        </div>
        <ChatBubbleFooter
          thread={thread}
          reactions={reactions}
          onReact={onReact}
        />
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
          <Avatar label={author.name} color={author.color} decorative size="sm">
            {author.initials}
          </Avatar>
        ) : (
          <span
            className="hub__chat-bubble__avatar-spacer"
            aria-hidden="true"
          />
        )}
        <div className="hub__chat-bubble__body">
          {content}
          <MessageHoverToolbar onReact={onReact} compact={compactToolbar} />
        </div>
      </div>
      <ChatBubbleFooter
        thread={thread}
        reactions={reactions}
        onReact={onReact}
      />
    </div>
  );
};
