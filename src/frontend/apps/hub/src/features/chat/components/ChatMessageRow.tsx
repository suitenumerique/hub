import { memo, type ReactNode, type Ref } from "react";

import type {
  ChatMessage,
  ChatMessageAuthor,
  ChatRef,
} from "@/features/drivers/types";

import { ChatBubble } from "./ChatBubble";
import { UnreadSeparator } from "./UnreadSeparator";

type ChatMessageRowProps = {
  message: ChatMessage;
  chatRef: ChatRef;
  prev: ChatMessage | undefined;
  next: ChatMessage | undefined;
  authorsById: Map<string, ChatMessageAuthor>;
  showUnreadSeparator: boolean;
  unreadSeparatorRef?: Ref<HTMLDivElement>;
};

/** One memoized Virtuoso row, including grouping around the unread boundary. */
export const ChatMessageRow = memo(function ChatMessageRow({
  message,
  chatRef,
  prev,
  next,
  authorsById,
  showUnreadSeparator,
  unreadSeparatorRef,
}: ChatMessageRowProps) {
  const isSent = message.authorId === "me";
  const isFirstOfGroup = !prev || prev.authorId !== message.authorId;
  const isLastOfGroup = !next || next.authorId !== message.authorId;

  if (isSent) {
    return (
      <RowShell
        messageId={message.id}
        separator={showUnreadSeparator}
        unreadSeparatorRef={unreadSeparatorRef}
      >
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
    <RowShell
      messageId={message.id}
      separator={showUnreadSeparator}
      unreadSeparatorRef={unreadSeparatorRef}
    >
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
  separator,
  unreadSeparatorRef,
}: {
  children: ReactNode;
  messageId: string;
  separator: boolean;
  unreadSeparatorRef?: Ref<HTMLDivElement>;
}) => (
  <div className="hub__chat-conversation__row" data-chat-message-id={messageId}>
    <div className="hub__chat-conversation__row-inner">
      {separator ? <UnreadSeparator ref={unreadSeparatorRef} /> : null}
      {children}
    </div>
  </div>
);
