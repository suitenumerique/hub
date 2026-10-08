import { type InfiniteData, skipToken, useQuery } from "@tanstack/react-query";
import { Fragment, useRef } from "react";
import { useTranslation } from "react-i18next";

import type {
  ChatAttachment,
  ChatMessagesPage,
  ChatRef,
} from "@/features/drivers/types";

import type {
  DraftThreadRoot,
  OpenThreadOptions,
} from "../../ChatPanelContext";
import { chatKeys } from "../../chatKeys";
import { useUploadChatAttachment } from "../../hooks/useChatAttachmentActions";
import { useStartChatThread } from "../../hooks/useStartChatThread";
import { useCanSendToChat } from "../../hooks/useChatSecurity";
import { ChatBubble } from "../ChatBubble";
import { ChatComposer } from "../ChatComposer";
import { ChatEncryptionPrompt } from "../ChatEncryptionPrompt";

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
  const canSend = useCanSendToChat(chatRef);
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
  const uploadAttachment = useUploadChatAttachment(chatRef);
  const createdThreadIdRef = useRef<string | null>(null);
  // Files dropped anywhere on the thread go to its composer.
  const detailRef = useRef<HTMLDivElement>(null);

  // Text and files sent together each relate to the root: the first one starts
  // the thread, the next ones reply in it (Matrix threads are keyed by root).
  const send = (content: string, attachment?: ChatAttachment) =>
    startThread(message, content, {
      rootAuthor: author,
      attachment,
      onCreated: (threadId) => {
        createdThreadIdRef.current = threadId;
      },
    });

  // Stay on the draft until Matrix confirms the real root id and everything
  // is sent: opening the thread unmounts this composer, and opening the
  // optimistic id would enable a second composer that could send a reply to a
  // relation target which does not exist on the homeserver.
  const openCreatedThread = () => {
    if (createdThreadIdRef.current) {
      onCreated(createdThreadIdRef.current, { focusComposer: true });
    }
  };

  return (
    <>
      <ToolsPanelHeader
        title={t("Thread")}
        isOpen={isOpen}
        onClose={onClose}
        onBack={onBack}
      />
      <div className="hub__thread-detail" ref={detailRef}>
        <div className="hub__thread-detail__messages">
          <Fragment>
            {message.authorId === "me" ? (
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
                  htmlContent={message.htmlContent}
                  attachment={message.attachment}
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
          {!canSend && <ChatEncryptionPrompt accountId={chatRef.accountId} />}
          <ChatComposer
            conversationId={root.message.id}
            placeholder={
              isSupported
                ? t("Answer")
                : t("Replying isn't available on this account yet.")
            }
            inputLabel={t("Answer")}
            disabled={!isSupported || !canSend}
            isSubmitting={isStarting}
            focusSignal={isOpen ? composerFocusSignal : undefined}
            onSubmit={(content) => send(content)}
            onSendAttachment={(attachment) => send("", attachment)}
            onUploadAttachment={isSupported ? uploadAttachment : undefined}
            dropTargetRef={detailRef}
            onSubmitted={openCreatedThread}
          />
        </div>
      </div>
    </>
  );
};
