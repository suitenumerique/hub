import { Bell } from "@gouvfr-lasuite/ui-kit/icons";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { ChatMessageAuthor } from "@/features/drivers/types";

import { useChatThread } from "../../hooks/useChatThread";
import { useChatThreadActions } from "../../hooks/useChatThreadActions";
import { ChatBubble } from "../ChatBubble";
import { ChatComposer } from "../ChatComposer";

import { ToolsPanelHeader } from "./ToolsPanelHeader";

type ThreadDetailProps = {
  chatId: string;
  threadId: string;
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
};

/** Threads panel detail view — a single thread's root message and replies. */
export const ThreadDetail = ({
  chatId,
  threadId,
  isOpen,
  onClose,
  onBack,
}: ThreadDetailProps) => {
  const { t } = useTranslation();
  const { thread, isInitialLoading, isError, refetch } = useChatThread(
    chatId,
    threadId,
  );
  const { markThreadRead } = useChatThreadActions(chatId);
  const messagesRef = useRef<HTMLDivElement>(null);

  // On open, jump to the first unread reply — or to the latest message when the
  // thread is fully read — so the reader lands on what matters. Gated by
  // `isOpen` because `ThreadDetail` stays mounted while the panel close
  // animation runs (see `ThreadsTool`), and we want the scroll logic to re-run
  // when the panel is reopened on the same thread.
  useEffect(() => {
    const container = messagesRef.current;
    if (!isOpen || !container || !thread) {
      return;
    }
    const separator = container.querySelector<HTMLElement>(
      ".hub__thread-detail__unread",
    );
    container.scrollTop = separator
      ? Math.max(0, separator.offsetTop - 12)
      : container.scrollHeight;
  }, [isOpen, thread]);

  // Opening a thread marks its replies read. `markThreadRead` updates the list
  // and the bubble badge but not this thread's cache entry, so the "Unread"
  // separator stays put while the reader is still in the thread. Gated by
  // `isOpen` so we don't clear unread state while the panel is closed.
  useEffect(() => {
    if (isOpen && thread && thread.firstUnreadIndex !== null) {
      markThreadRead(threadId);
    }
  }, [isOpen, thread, threadId, markThreadRead]);

  const authorsById = useMemo(() => {
    const map = new Map<string, ChatMessageAuthor>();
    thread?.authors.forEach((author) => map.set(author.id, author));
    return map;
  }, [thread]);

  // Inert — thread mute is wired through the driver in a later change.
  const muteAction = (
    <button
      type="button"
      className="hub__chat-tools-panel__header-button"
      aria-label={t("Mute thread")}
      tabIndex={isOpen ? 0 : -1}
      disabled
      aria-disabled="true"
    >
      <Bell />
    </button>
  );

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

    if (isError || !thread) {
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
      <div className="hub__thread-detail">
        <div className="hub__thread-detail__messages" ref={messagesRef}>
          {thread.messages.map((message, index) => {
            const prev = thread.messages[index - 1];
            const next = thread.messages[index + 1];
            const isSent = message.authorId === "me";
            const isFirstOfGroup = !prev || prev.authorId !== message.authorId;
            const isLastOfGroup = !next || next.authorId !== message.authorId;
            const author = authorsById.get(message.authorId);

            return (
              <Fragment key={message.id}>
                {index === thread.firstUnreadIndex && (
                  <div className="hub__thread-detail__unread" role="separator">
                    <span>{t("Unread")}</span>
                  </div>
                )}
                {isSent ? (
                  <ChatBubble
                    variant="sent"
                    chatId={chatId}
                    messageId={message.id}
                    content={message.content}
                    timestamp={message.timestamp}
                    reactions={message.reactions}
                    threadId={threadId}
                    showTimestamp={isLastOfGroup}
                  />
                ) : (
                  author && (
                    <ChatBubble
                      variant="received"
                      chatId={chatId}
                      messageId={message.id}
                      content={message.content}
                      author={author}
                      timestamp={message.timestamp}
                      reactions={message.reactions}
                      threadId={threadId}
                      showHeader={isFirstOfGroup}
                      showAvatar={isLastOfGroup}
                    />
                  )
                )}
              </Fragment>
            );
          })}
        </div>
        <div className="hub__thread-detail__composer">
          <ChatComposer placeholder={t("Answer")} inputLabel={t("Answer")} />
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
        action={muteAction}
      />
      {renderBody()}
    </>
  );
};
