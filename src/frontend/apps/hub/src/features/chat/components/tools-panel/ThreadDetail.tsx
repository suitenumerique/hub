import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  type ContextProp,
  Virtuoso,
  type VirtuosoHandle,
} from "react-virtuoso";

import type {
  ChatAttachment,
  ChatComposedMessage,
  ChatMessageAuthor,
  ChatRef,
} from "@/features/drivers/types";

import {
  ChatMessageEditProvider,
  type EditingChatMessage,
} from "../../ChatMessageEditContext";
import { isSameChatDay } from "../../formatTimestamp";
import { useUploadChatAttachment } from "../../hooks/useChatAttachmentActions";
import { useChatThread } from "../../hooks/useChatThread";
import { useChatThreadActions } from "../../hooks/useChatThreadActions";
import { useEditChatMessage } from "../../hooks/useEditChatMessage";
import { useSendChatThreadReply } from "../../hooks/useSendChatThreadReply";
import { useChatSendState } from "../../hooks/useChatSecurity";
import { ChatBubble } from "../ChatBubble";
import { ChatComposer } from "../ChatComposer";
import { ChatEncryptionPrompt } from "../ChatEncryptionPrompt";

import { ToolsPanelHeader } from "./ToolsPanelHeader";

type ThreadDetailProps = {
  chatRef: ChatRef;
  threadId: string;
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  composerFocusSignal?: number;
};

type ThreadMessagesContext = {
  isFetchingOlder: boolean;
  isFetchOlderError: boolean;
  onRetry: () => void;
};

const DEFAULT_ITEM_HEIGHT = 72;
const LAST_MESSAGE = { index: "LAST", align: "end" } as const;

// Stable header: the loader state arrives through Virtuoso's context. Its
// spacer keeps the first message below the floating panel header.
const ThreadMessagesHeader = ({
  context,
}: ContextProp<ThreadMessagesContext>) => {
  const { t } = useTranslation();
  return (
    <div className="hub__thread-detail__top-spacer">
      {context.isFetchingOlder && (
        <div className="hub__thread-detail__loader" role="status">
          <span className="material-icons" aria-hidden="true">
            sync
          </span>
          {t("Loading older messages…")}
        </div>
      )}
      {!context.isFetchingOlder && context.isFetchOlderError && (
        <div className="hub__thread-detail__loader" role="alert">
          {t("Older messages could not be loaded.")}
          <button
            type="button"
            className="hub__chat-tools-panel__state__retry"
            onClick={context.onRetry}
          >
            {t("Retry")}
          </button>
        </div>
      )}
    </div>
  );
};

const ThreadMessagesFooter = () => (
  <div className="hub__thread-detail__bottom-spacer" />
);

// Stable component types: Virtuoso remounts every row when they change.
const THREAD_MESSAGES_COMPONENTS = {
  Header: ThreadMessagesHeader,
  Footer: ThreadMessagesFooter,
};

/**
 * Threads panel detail view — a single thread's root message and replies,
 * opened on the latest replies as Element's thread view: older ones load
 * while scrolling up.
 */
export const ThreadDetail = ({
  chatRef,
  threadId,
  isOpen,
  onClose,
  onBack,
  composerFocusSignal,
}: ThreadDetailProps) => {
  const { t } = useTranslation();
  const sendState = useChatSendState(chatRef);
  const mentionSource = useMemo(
    () => ({ accountId: chatRef.accountId, chatRef }),
    [chatRef],
  );
  const {
    thread,
    messages,
    firstItemIndex,
    isFetchingOlder,
    isFetchOlderError,
    isInitialLoading,
    refetch,
    fetchOlder,
  } = useChatThread(chatRef, threadId);
  const { markThreadRead } = useChatThreadActions(chatRef);
  const { sendReply, isSending, isSupported } = useSendChatThreadReply(
    chatRef,
    threadId,
  );
  const { editMessage, isEditing } = useEditChatMessage(chatRef, threadId);
  const [editingMessage, setEditingMessage] =
    useState<EditingChatMessage | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  // Files dropped anywhere on the thread go to its composer.
  const detailRef = useRef<HTMLDivElement>(null);
  const previousMessagesRef = useRef<{
    threadId: string | null;
    messageCount: number;
    lastMessageId: string | null;
  }>({
    threadId: null,
    messageCount: 0,
    lastMessageId: null,
  });
  const lastMarkedReadRef = useRef<string | null>(null);
  const lastMessage = thread?.messages[thread.messages.length - 1];

  useEffect(() => setEditingMessage(null), [threadId]);

  const handleSubmit = useCallback(
    async (composed: ChatComposedMessage) => {
      if (editingMessage) {
        const message = await editMessage(editingMessage.id, composed);
        setEditingMessage(null);
        return message;
      }
      return sendReply(composed);
    },
    [editMessage, editingMessage, sendReply],
  );
  const handleSendAttachment = useCallback(
    (attachment: ChatAttachment) => sendReply({ content: "" }, attachment),
    [sendReply],
  );
  const uploadAttachment = useUploadChatAttachment(chatRef);
  const editContext = useMemo(() => ({ startEditing: setEditingMessage }), []);

  // The list opens on the latest message. Gated by `isOpen` because
  // `ThreadDetail` stays mounted while the panel close animation runs (see
  // `ThreadsTool`): reopening the panel on the same thread lands there again.
  useEffect(() => {
    if (isOpen) {
      virtuosoRef.current?.scrollToIndex(LAST_MESSAGE);
    }
  }, [isOpen, thread?.id]);

  useLayoutEffect(() => {
    const previous = previousMessagesRef.current;
    const isSameThread = previous.threadId === threadId;
    const didAppendLatest =
      (thread?.messages.length ?? 0) > previous.messageCount &&
      lastMessage?.id !== previous.lastMessageId;

    previousMessagesRef.current = {
      threadId,
      messageCount: thread?.messages.length ?? 0,
      lastMessageId: lastMessage?.id ?? null,
    };

    if (
      !isOpen ||
      !isSameThread ||
      !didAppendLatest ||
      lastMessage?.authorId !== "me"
    ) {
      return;
    }

    virtuosoRef.current?.scrollToIndex(LAST_MESSAGE);
  }, [
    isOpen,
    lastMessage?.authorId,
    lastMessage?.id,
    thread?.messages.length,
    threadId,
  ]);

  // A server notification count can say "unread" even when the SDK cannot
  // locate the first unread reply in the loaded timeline. Mark the latest
  // visible reply instead of using `firstUnreadIndex` as a receipt gate. The
  // event id keeps cache refetches from resending the same receipt, while a new
  // reply received in an open thread advances it again. As Element's
  // `ignoreOwn`, this user's own replies, sent or still sending, never do.
  const lastOtherReply = thread?.messages.findLast(
    (message) =>
      message.authorId !== "me" && message.id !== thread.rootMessageId,
  );
  useEffect(() => {
    if (!isOpen) {
      lastMarkedReadRef.current = null;
      return;
    }
    if (!lastOtherReply) {
      return;
    }
    const receiptKey = `${threadId}:${lastOtherReply.id}`;
    if (lastMarkedReadRef.current === receiptKey) {
      return;
    }
    lastMarkedReadRef.current = receiptKey;
    markThreadRead(threadId);
  }, [isOpen, lastOtherReply, markThreadRead, threadId]);

  const authorsById = useMemo(() => {
    const map = new Map<string, ChatMessageAuthor>();
    thread?.authors.forEach((author) => map.set(author.id, author));
    return map;
  }, [thread]);

  const renderBody = () => {
    if (isInitialLoading) {
      return (
        <div className="hub__chat-tools-panel__content">
          <p className="hub__chat-tools-panel__state" role="status">
            {t("Loading thread…")}
          </p>
        </div>
      );
    }

    if (!thread) {
      return (
        <div className="hub__chat-tools-panel__content">
          <div className="hub__chat-tools-panel__state" role="alert">
            <p>{t("This thread could not be loaded.")}</p>
            <button
              type="button"
              className="hub__chat-tools-panel__state__retry"
              onClick={refetch}
            >
              {t("Retry")}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="hub__thread-detail" ref={detailRef}>
        <div className="hub__thread-detail__messages">
          <Virtuoso
            key={threadId}
            ref={virtuosoRef}
            // The scroller is focusable: name it for keyboard users.
            aria-label={t("Thread")}
            data={messages}
            context={{
              isFetchingOlder,
              isFetchOlderError,
              onRetry: fetchOlder,
            }}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={LAST_MESSAGE}
            computeItemKey={(_index, message) => message.id}
            defaultItemHeight={DEFAULT_ITEM_HEIGHT}
            // Measure rows before paint, as the conversation timeline does: a
            // row rendered above the viewport never shifts the visible ones.
            skipAnimationFrameInResizeObserver
            // New replies scroll into view while the latest one is shown.
            followOutput="auto"
            startReached={fetchOlder}
            // Coming back to the top asks again, after a failure too:
            // Virtuoso reports `startReached` only for a new first row.
            atTopStateChange={(atTop) => {
              if (atTop) fetchOlder();
            }}
            increaseViewportBy={{ top: 400, bottom: 0 }}
            components={THREAD_MESSAGES_COMPONENTS}
            itemContent={(virtualIndex, message) => {
              const index = virtualIndex - firstItemIndex;
              const prev = messages[index - 1];
              const next = messages[index + 1];
              const isSent = message.authorId === "me";
              const isFirstOfGroup =
                !prev ||
                prev.authorId !== message.authorId ||
                !isSameChatDay(prev.timestamp, message.timestamp);
              const isLastOfGroup =
                !next ||
                next.authorId !== message.authorId ||
                !isSameChatDay(message.timestamp, next.timestamp);
              const author = authorsById.get(message.authorId);

              return (
                <div className="hub__thread-detail__row">
                  {isSent ? (
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
                      availability={message.availability}
                      canEdit={message.canEdit}
                      canDelete={message.canDelete}
                      threadId={threadId}
                      showTimestamp={isLastOfGroup}
                    />
                  ) : (
                    author && (
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
                        availability={message.availability}
                        canEdit={message.canEdit}
                        canDelete={message.canDelete}
                        threadId={threadId}
                        showHeader={isFirstOfGroup}
                        showAvatar={isLastOfGroup}
                      />
                    )
                  )}
                </div>
              );
            }}
          />
        </div>
        <div className="hub__thread-detail__composer">
          {sendState === "blocked" && (
            <ChatEncryptionPrompt accountId={chatRef.accountId} />
          )}
          <ChatComposer
            conversationId={threadId}
            placeholder={
              isSupported
                ? t("Answer")
                : t("Replying isn't available on this account yet.")
            }
            inputLabel={t("Answer")}
            disabled={!isSupported || sendState === "blocked"}
            isSubmitting={isSending || isEditing}
            focusSignal={isOpen ? composerFocusSignal : undefined}
            errorMessage={
              editingMessage
                ? t("Your message could not be edited. Please try again.")
                : undefined
            }
            editDraft={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
            onSubmit={sendState === "checking" ? undefined : handleSubmit}
            onSendAttachment={handleSendAttachment}
            onUploadAttachment={isSupported ? uploadAttachment : undefined}
            dropTargetRef={detailRef}
            mentions={mentionSource}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      <ToolsPanelHeader
        title={t("Thread")}
        isOpen={isOpen}
        onClose={onClose}
        onBack={onBack}
      />
      <ChatMessageEditProvider value={editContext}>
        {renderBody()}
      </ChatMessageEditProvider>
    </>
  );
};
