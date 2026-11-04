import { memo } from "react";

import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatRef,
} from "@/features/drivers/types";

import { isSameChatDay } from "../formatTimestamp";

import { ChatBubble } from "./ChatBubble";
import { UnreadSeparator } from "./UnreadSeparator";

type RowProps = {
  message: ChatMessage;
  chatRef: ChatRef;
  prev: ChatMessage | undefined;
  next: ChatMessage | undefined;
  authorsById: Map<string, ChatMessageAuthor>;
  hasUnreadSeparator: boolean;
  isHighlighted: boolean;
};

export const ChatTimelineRow = memo(function ChatTimelineRow({
  message,
  chatRef,
  prev,
  next,
  authorsById,
  hasUnreadSeparator,
  isHighlighted,
}: RowProps) {
  const isSent = message.authorId === "me";
  const isFirstOfGroup =
    !prev ||
    prev.authorId !== message.authorId ||
    !isSameChatDay(prev.timestamp, message.timestamp);
  const isLastOfGroup =
    !next ||
    next.authorId !== message.authorId ||
    !isSameChatDay(message.timestamp, next.timestamp);

  if (isSent) {
    return (
      <RowShell
        messageId={message.id}
        isFirstOfGroup={isFirstOfGroup}
        hasUnreadSeparator={hasUnreadSeparator}
      >
        <ChatBubble
          variant="sent"
          chatRef={chatRef}
          messageId={message.id}
          content={message.content}
          htmlContent={message.htmlContent}
          attachment={message.attachment}
          timestamp={message.timestamp}
          reactions={message.reactions}
          isDeleted={message.isDeleted}
          isEdited={message.isEdited}
          replyToId={message.replyToId}
          isHighlighted={isHighlighted}
          availability={message.availability}
          canEdit={message.canEdit}
          canDelete={message.canDelete}
          thread={message.thread}
          showTimestamp={isLastOfGroup}
        />
      </RowShell>
    );
  }

  const author = authorsById.get(message.authorId);
  if (!author) {
    return null;
  }
  return (
    <RowShell
      messageId={message.id}
      isFirstOfGroup={isFirstOfGroup}
      hasUnreadSeparator={hasUnreadSeparator}
    >
      <ChatBubble
        variant="received"
        chatRef={chatRef}
        messageId={message.id}
        content={message.content}
        htmlContent={message.htmlContent}
        attachment={message.attachment}
        author={author}
        timestamp={message.timestamp}
        reactions={message.reactions}
        isDeleted={message.isDeleted}
        isEdited={message.isEdited}
        replyToId={message.replyToId}
        isHighlighted={isHighlighted}
        availability={message.availability}
        canEdit={message.canEdit}
        canDelete={message.canDelete}
        thread={message.thread}
        showHeader={isFirstOfGroup}
        showAvatar={isLastOfGroup}
      />
    </RowShell>
  );
});

const RowShell = ({
  children,
  messageId,
  isFirstOfGroup,
  hasUnreadSeparator,
}: {
  children: React.ReactNode;
  messageId: string;
  isFirstOfGroup: boolean;
  hasUnreadSeparator: boolean;
}) => (
  <div
    className="hub__chat-conversation__row"
    data-chat-message-id={messageId}
    data-group-start={isFirstOfGroup || undefined}
  >
    <div className="hub__chat-conversation__row-inner">
      {hasUnreadSeparator && <UnreadSeparator />}
      {children}
    </div>
  </div>
);
