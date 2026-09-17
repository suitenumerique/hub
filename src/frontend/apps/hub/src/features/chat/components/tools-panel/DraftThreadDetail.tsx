import { type InfiniteData, skipToken, useQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import type { ChatMessagesPage, ChatRef } from "@/features/drivers/types";

import type {
  DraftThreadRoot,
  OpenThreadOptions,
} from "../../ChatPanelContext";
import { chatKeys } from "../../chatKeys";
import { useStartChatThread } from "../../hooks/useStartChatThread";
import { ChatBubble } from "../ChatBubble";
import { ChatComposer } from "../ChatComposer";

import { ToolsPanelHeader } from "./ToolsPanelHeader";

type DraftThreadDetailProps = {
  chatRef: ChatRef;
  root: DraftThreadRoot;
  composerFocusSignal: number;
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  onCreated: (threadId: string, options?: OpenThreadOptions) => void;
};

export const DraftThreadDetail = ({
  chatRef,
  root,
  composerFocusSignal,
  isOpen,
  onClose,
  onBack,
  onCreated,
}: DraftThreadDetailProps) => {
  const { t } = useTranslation();
  const { startThread, isStarting, isSupported } = useStartChatThread(chatRef);
  // The draft root is a snapshot from when Reply was clicked. Subscribe to
  // its cached message so reactions stay live before the first reply is sent.
  const { data: cachedMessage } = useQuery({
    queryKey: chatKeys.messages(chatRef),
    queryFn: skipToken,
    select: (data: InfiniteData<ChatMessagesPage>) => {
      for (const page of data.pages) {
        const message = page.messages.find(({ id }) => id === root.message.id);
        if (message) {
          return message;
        }
      }
    },
  });
  const message = cachedMessage ?? root.message;
  const { author } = root;

  const handleSubmit = (content: string) =>
    startThread(message, content, {
      rootAuthor: author,
      // Stay on the draft until Matrix confirms the real root id. Opening the
      // optimistic id would enable a second composer that could send a reply to
      // a relation target which does not exist on the homeserver.
      onCreated: (threadId) => {
        onCreated(threadId, { focusComposer: true });
      },
    });

  return (
    <>
      <ToolsPanelHeader
        title={t("Thread")}
        isOpen={isOpen}
        onClose={onClose}
        onBack={onBack}
      />
      <div className="hub__thread-detail">
        <div className="hub__thread-detail__messages">
          <Fragment>
            {message.authorId === "me" ? (
              <ChatBubble
                variant="sent"
                chatRef={chatRef}
                messageId={message.id}
                content={message.content}
                timestamp={message.timestamp}
                reactions={message.reactions}
                isDeleted={message.isDeleted}
                isEdited={message.isEdited}
                canEdit={false}
                canDelete={false}
                thread={message.thread}
                compactToolbar
                showTimestamp
              />
            ) : (
              author && (
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
                  canEdit={false}
                  canDelete={false}
                  thread={message.thread}
                  compactToolbar
                  showHeader
                  showAvatar
                />
              )
            )}
          </Fragment>
        </div>
        <div className="hub__thread-detail__composer">
          <ChatComposer
            conversationId={root.message.id}
            placeholder={
              isSupported
                ? t("Answer")
                : t("Replying isn't available on this account yet.")
            }
            inputLabel={t("Answer")}
            disabled={!isSupported}
            isSubmitting={isStarting}
            focusSignal={isOpen ? composerFocusSignal : undefined}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </>
  );
};
