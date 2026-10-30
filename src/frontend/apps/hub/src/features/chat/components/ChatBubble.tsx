import { Trash } from "@gouvfr-lasuite/ui-components/icons";
import {
  type MouseEvent,
  type SyntheticEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
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
import { useEnsureMessageDecrypted } from "../hooks/useEnsureMessageDecrypted";
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
  /** Whether the content is readable, or an encrypted placeholder. */
  availability?: ChatMessage["availability"];
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
  /** Whether the content is readable, or an encrypted placeholder. */
  availability?: ChatMessage["availability"];
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

// Space kept between the toolbar and the sides of the message list.
const TOOLBAR_EDGE_MARGIN = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/** The message list's visible box, or the window outside a list. */
const listBounds = (body: HTMLElement) => {
  const list = body.closest<HTMLElement>("[data-virtuoso-scroller]");
  if (!list) {
    return {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    };
  }
  const { left, top } = list.getBoundingClientRect();
  return {
    left,
    top,
    right: left + list.clientWidth,
    bottom: top + list.clientHeight,
  };
};

/**
 * Places the menu with its top-left corner at a point, as a context menu
 * opens: below and right of it, or on the other side where the list has no
 * room, and never out of the list. Returns whether the bubble has a menu.
 */
const placeToolbarAt = (body: HTMLElement, x: number, y: number) => {
  const toolbar = body.querySelector<HTMLElement>(".hub__message-toolbar");
  if (!toolbar) return false;
  const { offsetWidth: width, offsetHeight: height } = toolbar;
  const bubble = body.getBoundingClientRect();
  const bounds = listBounds(body);
  const maxLeft = bounds.right - TOOLBAR_EDGE_MARGIN - width;
  const maxTop = bounds.bottom - TOOLBAR_EDGE_MARGIN - height;
  const left = clamp(
    x > maxLeft ? x - width : x,
    bounds.left + TOOLBAR_EDGE_MARGIN,
    maxLeft,
  );
  const top = clamp(
    y > maxTop ? y - height : y,
    bounds.top + TOOLBAR_EDGE_MARGIN,
    maxTop,
  );
  body.style.setProperty(
    "--hub-message-toolbar-left",
    `${left - bubble.left}px`,
  );
  body.style.setProperty("--hub-message-toolbar-top", `${top - bubble.top}px`);
  return true;
};

/**
 * From the keyboard, shows the menu beside the bubble while one of its buttons
 * has the focus: past the corner toward the middle of the conversation. The
 * menu opened by a right click stays at the pointer.
 */
const placeToolbar = (event: SyntheticEvent<HTMLDivElement>) => {
  const body = event.currentTarget;
  const toolbar = body.querySelector<HTMLElement>(".hub__message-toolbar");
  if (!toolbar || body.dataset.toolbarOpen !== undefined) return;
  const bubble = body.getBoundingClientRect();
  const isSent = body.closest(".hub__chat-bubble--sent") !== null;
  placeToolbarAt(
    body,
    isSent
      ? bubble.left - TOOLBAR_EDGE_MARGIN - toolbar.offsetWidth
      : bubble.right + TOOLBAR_EDGE_MARGIN,
    bubble.top,
  );
};

/** A right click on a link or on selected text keeps the browser's menu. */
const keepsNativeMenu = (body: HTMLElement, target: Element) => {
  if (target.closest("a[href]")) return true;
  const selection = window.getSelection();
  return Boolean(
    selection &&
    !selection.isCollapsed &&
    selection.toString().trim() &&
    selection.containsNode(body, true),
  );
};

/**
 * Below the bubble: the reactions bar, then the thread button under it, as in
 * the design.
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
      <MessageReactions reactions={reactions} onReact={onReact} />
      {thread && (
        <ThreadButton summary={thread} onOpen={() => openThread(thread.id)} />
      )}
    </div>
  );
};

export const ChatBubble = (props: ChatBubbleProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { attachment, chatRef, messageId, reactions, thread, threadId } = props;
  useEnsureMessageDecrypted(chatRef, messageId, props.availability);
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
  // The actions menu shows at the pointer after a right click on the bubble.
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const closeToolbar = useCallback(() => setIsToolbarOpen(false), []);
  const openToolbar = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const body = event.currentTarget;
    const target = event.target as Element;
    if (target.closest(".hub__message-toolbar")) {
      event.preventDefault();
      return;
    }
    if (keepsNativeMenu(body, target)) return;
    // A right click from the keyboard has no pointer: open on the bubble.
    const bubble = body.getBoundingClientRect();
    const fromKeyboard = event.clientX === 0 && event.clientY === 0;
    const isPlaced = placeToolbarAt(
      body,
      fromKeyboard ? bubble.left : event.clientX,
      fromKeyboard ? bubble.top : event.clientY,
    );
    // A deleted message has no menu: the browser's own one stays.
    if (!isPlaced) return;
    event.preventDefault();
    setIsToolbarOpen(true);
  }, []);
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
        isOpen={isToolbarOpen}
        onClose={closeToolbar}
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
          data-toolbar-open={isToolbarOpen || undefined}
          onFocus={placeToolbar}
          onContextMenu={openToolbar}
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
          data-toolbar-open={isToolbarOpen || undefined}
          onFocus={placeToolbar}
          onContextMenu={openToolbar}
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
