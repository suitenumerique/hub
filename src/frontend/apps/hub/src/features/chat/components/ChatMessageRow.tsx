import { memo, type ReactNode } from "react";

import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatRef,
} from "@/features/drivers/types";

import { ChatBubble } from "./ChatBubble";
type ChatMessageRowProps = {
  message: ChatMessage;
  chatRef: ChatRef;
  prev: ChatMessage | undefined;
  next: ChatMessage | undefined;
  authorsById: Map<string, ChatMessageAuthor>;
  rowIndex: number;
};

/** One memoized message row. The unread marker is its own Virtuoso row. */
export const ChatMessageRow = memo(function ChatMessageRow({
  message,
  chatRef,
  prev,
  next,
  authorsById,
  rowIndex,
}: ChatMessageRowProps) {
  const isSent = message.authorId === "me";
  const isFirstOfGroup = !prev || prev.authorId !== message.authorId;
  const isLastOfGroup = !next || next.authorId !== message.authorId;

  if (isSent) {
    return (
      <RowShell messageId={message.id} rowIndex={rowIndex}>
        <ChatBubble
          variant="sent"
          chatRef={chatRef}
          messageId={message.id}
          content={message.content}
          timestamp={message.timestamp}
          reactions={message.reactions}
          isDeleted={message.isDeleted}
          isEdited={message.isEdited}
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
    <RowShell messageId={message.id} rowIndex={rowIndex}>
      <ChatBubble
        variant="received"
        chatRef={chatRef}
        messageId={message.id}
        content={message.content}
        author={author}
        timestamp={message.timestamp}
        reactions={message.reactions}
        isDeleted={message.isDeleted}
        isEdited={message.isEdited}
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
  rowIndex,
}: {
  children: ReactNode;
  messageId: string;
  rowIndex: number;
}) => (
  <div
    className="hub__chat-conversation__row"
    data-chat-timeline-row
    data-chat-row-index={rowIndex}
    data-chat-message-id={messageId}
  >
    <div className="hub__chat-conversation__row-inner">{children}</div>
  </div>
);
