import { Trash } from "@gouvfr-lasuite/ui-components/icons";
import { type PointerEvent, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type {
  ChatAttachment,
  ChatRef,
  ChatMessage,
  ChatMessageAuthor,
  ChatReaction,
  ChatThreadSummary,
} from "@/features/drivers/types";

import { useChatPanel } from "../ChatPanelContext";
import { useChatMessageEdit } from "../ChatMessageEditContext";
import { copyTextToClipboard } from "../copyTextToClipboard";
import { formatChatGroupTimestamp } from "../formatTimestamp";
import { isOptimisticThreadId } from "../hooks/chatCompositionCache";
import { useDownloadChatAttachment } from "../hooks/useChatAttachmentActions";
import { useChatCompositionSupport } from "../hooks/useChatCompositionSupport";
import { useDeleteChatMessage } from "../hooks/useDeleteChatMessage";
import { useToggleReaction } from "../hooks/useToggleReaction";
import { notify } from "@/features/ui/components/toast";

import { ChatUserAvatar } from "./ChatUserAvatar";
import { MessageAttachment } from "./MessageAttachment";
import { MessageContent } from "./MessageContent";
import { MessageHoverToolbar } from "./MessageHoverToolbar";
import { MessageReactions } from "./MessageReactions";
import { ThreadButton } from "./ThreadButton";

type ChatBubbleReceivedProps = {
  variant: "received";
  chatRef: ChatRef;
  messageId: string;
  content: string;
  htmlContent?: string;
  attachment?: ChatAttachment;
  author: ChatMessageAuthor;
  timestamp: string;
  reactions: ChatReaction[];
  isDeleted?: boolean;
  isEdited?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Thread opened from this message, if any. */
  thread?: ChatThreadSummary;
  /** Set when this bubble is rendered inside a thread's detail view. */
  threadId?: string;
  /** Drops Reply while keeping reactions and message actions. */
  compactToolbar?: boolean;
  showHeader: boolean;
  showAvatar: boolean;
};

type ChatBubbleSentProps = {
  variant: "sent";
  chatRef: ChatRef;
  messageId: string;
  content: string;
  htmlContent?: string;
  attachment?: ChatAttachment;
  timestamp: string;
  reactions: ChatReaction[];
  isDeleted?: boolean;
  isEdited?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Thread opened from this message, if any. */
  thread?: ChatThreadSummary;
  /** Set when this bubble is rendered inside a thread's detail view. */
  threadId?: string;
  /** Drops Reply while keeping reactions and message actions. */
  compactToolbar?: boolean;
  showTimestamp: boolean;
};

export type ChatBubbleProps = ChatBubbleReceivedProps | ChatBubbleSentProps;

const updateToolbarHoverWidth = (event: PointerEvent<HTMLDivElement>) => {
  const body = event.currentTarget;
  const toolbar = body.querySelector<HTMLElement>(".hub__message-toolbar");
  if (toolbar) {
    body.style.setProperty(
      "--hub-message-toolbar-width",
      `${toolbar.offsetWidth}px`,
    );
  }
};

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
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { attachment, chatRef, messageId, reactions, thread, threadId } = props;
  const { openThread, openDraftThread } = useChatPanel();
  const { startEditing } = useChatMessageEdit();
  const isCompositionSupported = useChatCompositionSupport(chatRef);
  const { deleteMessage } = useDeleteChatMessage(chatRef, threadId);
  const downloadAttachment = useDownloadChatAttachment(chatRef.accountId);

  // Single integration point with the data layer: the hover toolbar and the
  // reactions bar both receive the bound `onReact` callback and stay purely
  // presentational. `messageId` is stable per row, so `onReact` is too. Passing
  // `threadId` routes the toggle to the thread cache when inside a thread.
  const { toggle } = useToggleReaction(chatRef, threadId);
  const onReact = useCallback(
    (emoji: string) => toggle(messageId, emoji),
    [toggle, messageId],
  );
  // Inside a thread the toolbar drops Reply (Matrix has no nested threads),
  // while Copy / Edit / Delete remain available on every reply.
  const compactToolbar =
    threadId !== undefined || props.compactToolbar === true;
  const rootAuthor = props.variant === "received" ? props.author : undefined;
  const rootAuthorId = props.variant === "sent" ? "me" : props.author.id;
  const messageForAction = useMemo<ChatMessage>(
    () => ({
      id: messageId,
      authorId: rootAuthorId,
      content: props.content,
      htmlContent: props.htmlContent,
      attachment,
      timestamp: props.timestamp,
      reactions,
      thread,
      isDeleted: props.isDeleted,
      isEdited: props.isEdited,
      canEdit: props.canEdit,
      canDelete: props.canDelete,
    }),
    [
      attachment,
      messageId,
      props.canDelete,
      props.canEdit,
      props.content,
      props.htmlContent,
      props.isDeleted,
      props.isEdited,
      props.timestamp,
      reactions,
      rootAuthorId,
      thread,
    ],
  );
  const onCopy = useCallback(async () => {
    try {
      await copyTextToClipboard(props.content);
    } catch {
      notify.error(t("Failed to copy to clipboard"));
    }
  }, [props.content, t]);
  const onDownload = useCallback(() => {
    if (attachment) {
      void downloadAttachment(attachment);
    }
  }, [attachment, downloadAttachment]);
  const onEdit = useCallback(
    () =>
      startEditing({
        id: messageId,
        content: props.content,
        htmlContent: props.htmlContent,
      }),
    [messageId, props.content, props.htmlContent, startEditing],
  );
  const onDelete = useCallback(
    () => deleteMessage(messageForAction),
    [deleteMessage, messageForAction],
  );
  const isPendingThread = Boolean(thread && isOptimisticThreadId(thread.id));
  const canReply =
    (Boolean(thread) && !isPendingThread) ||
    (!thread && isCompositionSupported);
  const onReply = useCallback(() => {
    if (thread && !isOptimisticThreadId(thread.id)) {
      openThread(thread.id, { focusComposer: true });
      return;
    }
    if (thread) {
      return;
    }
    openDraftThread({
      message: {
        id: messageId,
        authorId: rootAuthorId,
        content: props.content,
        htmlContent: props.htmlContent,
        attachment,
        timestamp: props.timestamp,
        reactions,
        thread,
      },
      author: rootAuthor,
    });
  }, [
    attachment,
    messageId,
    openDraftThread,
    openThread,
    props.content,
    props.htmlContent,
    props.timestamp,
    reactions,
    rootAuthor,
    rootAuthorId,
    thread,
  ]);

  // Files render without the text bubble chrome; a caption stays below.
  const attachmentKind =
    attachment && !props.isDeleted ? attachment.kind : undefined;
  const renderBody = () => (
    <>
      {attachment ? (
        <>
          <MessageAttachment
            accountId={chatRef.accountId}
            messageId={messageId}
            attachment={attachment}
            senderName={rootAuthor?.name ?? t("You")}
            sentAt={props.timestamp}
            threadId={threadId}
          />
          {props.content && (
            <div className="hub__chat-bubble__caption">
              <MessageContent
                content={props.content}
                htmlContent={props.htmlContent}
              />
            </div>
          )}
        </>
      ) : (
        <MessageContent
          content={props.content}
          htmlContent={props.htmlContent}
        />
      )}
      {props.isEdited && (
        <span className="hub__chat-bubble__edited">{t("edited")}</span>
      )}
      <MessageHoverToolbar
        onReact={onReact}
        onReply={canReply ? onReply : undefined}
        onCopy={props.content ? onCopy : undefined}
        onDownload={attachment ? onDownload : undefined}
        onEdit={props.canEdit ? onEdit : undefined}
        onDelete={props.canDelete ? onDelete : undefined}
        compact={compactToolbar}
      />
    </>
  );

  if (props.variant === "sent") {
    return (
      <div
        className="hub__chat-bubble hub__chat-bubble--sent"
        data-message-id={messageId}
      >
        <div
          className="hub__chat-bubble__body"
          data-deleted={props.isDeleted || undefined}
          data-attachment={attachmentKind}
          onPointerEnter={updateToolbarHoverWidth}
        >
          {props.isDeleted ? (
            <span className="hub__chat-bubble__tombstone">
              <Trash size={16} aria-hidden="true" />
              {t("Message deleted")}
            </span>
          ) : (
            renderBody()
          )}
        </div>
        <ChatBubbleFooter
          thread={thread}
          reactions={reactions}
          onReact={onReact}
        />
        {props.showTimestamp && (
          <div className="hub__chat-bubble__timestamp">
            {formatChatGroupTimestamp(props.timestamp, locale)}
          </div>
        )}
      </div>
    );
  }

  const { author, timestamp, showHeader, showAvatar } = props;

  return (
    <div
      className="hub__chat-bubble hub__chat-bubble--received"
      data-message-id={messageId}
    >
      {showHeader && (
        <div className="hub__chat-bubble__header">
          <span className="hub__chat-bubble__author">{author.name}</span>
          <span className="hub__chat-bubble__header-dot" aria-hidden="true">
            •
          </span>
          <span className="hub__chat-bubble__timestamp">
            {formatChatGroupTimestamp(timestamp, locale)}
          </span>
        </div>
      )}
      <div className="hub__chat-bubble__row">
        {showAvatar ? (
          <ChatUserAvatar accountId={chatRef.accountId} user={author} />
        ) : (
          <span
            className="hub__chat-bubble__avatar-spacer"
            aria-hidden="true"
          />
        )}
        <div
          className="hub__chat-bubble__body"
          data-deleted={props.isDeleted || undefined}
          data-attachment={attachmentKind}
          onPointerEnter={updateToolbarHoverWidth}
        >
          {props.isDeleted ? (
            <span className="hub__chat-bubble__tombstone">
              <Trash size={16} aria-hidden="true" />
              {t("Message deleted")}
            </span>
          ) : (
            renderBody()
          )}
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
