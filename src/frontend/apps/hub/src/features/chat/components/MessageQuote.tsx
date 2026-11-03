import { Loader } from "@gouvfr-lasuite/ui-components/icons";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ChatRef } from "@/features/drivers/types";

import { useChatMessageJump } from "../ChatMessageJumpContext";
import { useChatPanel } from "../ChatPanelContext";
import { useEnsureMessageDecrypted } from "../hooks/useEnsureMessageDecrypted";
import { useQuotedChatMessage } from "../hooks/useQuotedChatMessage";

import { MessageContent } from "./MessageContent";

type MessageQuoteProps = {
  chatRef: ChatRef;
  /** Message the reply answers. */
  messageId: string;
  /** Set when the reply is rendered inside a thread's detail view. */
  threadId?: string;
};

// A jump resolved from memory ends before this delay: no spinner flashes.
const JUMP_LOADER_DELAY_MS = 200;

/**
 * The message a reply answers, quoted above the reply (Figma "Bubble", Quote
 * type): its author and its text, or why its text cannot be shown. Clicking
 * it goes to that message, as in Element.
 */
export const MessageQuote = ({
  chatRef,
  messageId,
  threadId,
}: MessageQuoteProps) => {
  const { t } = useTranslation();
  const {
    message,
    author,
    isHeld,
    threadId: quotedThreadId,
    isLoading,
    isError,
  } = useQuotedChatMessage(chatRef, threadId, messageId);
  // Its own row, which would decrypt it, may not be shown.
  useEnsureMessageDecrypted(chatRef, messageId, message?.availability);
  const jump = useChatMessageJump();
  const { openThread, jumpToConversationMessage } = useChatPanel();
  // Not in the list the reply is in: in a thread, from the conversation, or
  // in the conversation, from a thread.
  const isElsewhere = quotedThreadId !== threadId;
  const canJump = Boolean(
    message && (isElsewhere || (jump && (isHeld || jump.loadsMissing))),
  );
  const [isJumping, setIsJumping] = useState(false);
  const [isLoaderVisible, setIsLoaderVisible] = useState(false);

  const onJump = useCallback(async () => {
    if (isJumping) {
      return;
    }
    setIsJumping(true);
    try {
      // As Element's ViewRoom, which opens the thread of a thread message.
      if (isElsewhere && quotedThreadId) {
        openThread(quotedThreadId, { messageId });
      } else if (isElsewhere) {
        await jumpToConversationMessage(messageId);
      } else {
        await jump?.jumpTo(messageId);
      }
    } finally {
      setIsJumping(false);
    }
  }, [
    isElsewhere,
    isJumping,
    jump,
    jumpToConversationMessage,
    messageId,
    openThread,
    quotedThreadId,
  ]);

  // The jump waits for the whole window around the message, as the jump to
  // unread messages: only a wait for the homeserver shows the spinner.
  useEffect(() => {
    if (!isJumping) {
      return;
    }
    const timer = window.setTimeout(
      () => setIsLoaderVisible(true),
      JUMP_LOADER_DELAY_MS,
    );
    return () => {
      window.clearTimeout(timer);
      setIsLoaderVisible(false);
    };
  }, [isJumping]);

  const authorName = message?.authorId === "me" ? t("You") : author?.name;
  const isTextPending =
    isLoading || message?.availability === "encrypted-pending";
  const renderText = () => {
    if (
      isError ||
      !message ||
      message.availability === "encrypted-unavailable" ||
      message.availability === "encrypted-error"
    ) {
      return (
        <span className="hub__message-quote__status">
          {t("Message unavailable")}
        </span>
      );
    }
    if (message.isDeleted) {
      return (
        <span className="hub__message-quote__status">
          {t("Message deleted")}
        </span>
      );
    }
    return message.content ? (
      <MessageContent
        content={message.content}
        htmlContent={message.htmlContent}
      />
    ) : (
      message.attachment?.name
    );
  };

  return (
    <blockquote
      className="hub__message-quote"
      data-jumpable={canJump || undefined}
      data-no-author={(!isLoading && !authorName) || undefined}
      aria-busy={isJumping || isTextPending || undefined}
    >
      <span className="hub__visually-hidden">{t("In reply to")}</span>
      {/* As Element's reply preview, rows stand in for the author and text
          lines while the message loads: the quote keeps its height. */}
      {isLoading && (
        <div
          className="hub__message-quote__placeholder hub__message-quote__placeholder--author"
          aria-hidden="true"
        />
      )}
      {authorName && (
        <div className="hub__message-quote__author">{authorName}</div>
      )}
      {isTextPending ? (
        <>
          <span className="hub__visually-hidden">{t("Loading…")}</span>
          <div className="hub__message-quote__placeholder" aria-hidden="true" />
        </>
      ) : (
        <div className="hub__message-quote__text">{renderText()}</div>
      )}
      {/* Covers the quote, under its links, which stay clickable. */}
      {canJump && (
        <button
          type="button"
          className="hub__message-quote__jump"
          onClick={() => void onJump()}
        >
          <span className="hub__visually-hidden">
            {t("Go to the original message")}
          </span>
        </button>
      )}
      {isLoaderVisible && (
        <span className="hub__message-quote__loader" aria-hidden="true">
          <Loader className="hub__spinning-icon" />
        </span>
      )}
    </blockquote>
  );
};
