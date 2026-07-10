import { FilePreview } from "@gouvfr-lasuite/ui-kit";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Chat, ChatDocument, ChatRef } from "@/features/drivers/types";

import { isInvitationChat } from "../chatMembership";
import {
  ChatMessageEditProvider,
  type EditingChatMessage,
} from "../ChatMessageEditContext";
import {
  ChatPanelProvider,
  type DraftThreadRoot,
  type ChatPanelContextValue,
  type OpenThreadOptions,
} from "../ChatPanelContext";
import { useChat } from "../hooks/useChat";
import { useChatTyping } from "../hooks/useChatTyping";
import { useEditChatMessage } from "../hooks/useEditChatMessage";
import { useChatThreads } from "../hooks/useChatThreads";
import { useSendChatMessage } from "../hooks/useSendChatMessage";

import { ChatComposer } from "./ChatComposer";
import { ChatConversation } from "./ChatConversation";
import { ChatInvitationView } from "./ChatInvitationView";
import { ChatHeader } from "./header/ChatHeader";
import { ChatToolsPanel, ChatTool } from "./tools-panel/ChatToolsPanel";
import { documentToPreviewFile } from "./tools-panel/documentToPreviewFile";
import { UnreadThreadsBanner } from "./UnreadThreadsBanner";
import { TypingIndicator } from "./TypingIndicator";

type ChatViewProps = {
  chatRef: ChatRef | null;
  renderHeader?: (props: {
    chat: Chat | null;
    activeTool: ChatTool | null;
    onToggleTool: (tool: ChatTool) => void;
  }) => ReactNode;
  /** Rendered in the main area when there is no conversation yet. */
  renderEmpty?: () => ReactNode;
  /**
   * Called after a message is successfully sent. Lets the new-chat host commit
   * the URL to the resolved (or freshly created) conversation once the user
   * actually sends.
   */
  onSent?: (ref: ChatRef) => void;
  /** Bumped by the host to move focus into the composer (New Chat Enter). */
  composerFocusSignal?: number;
};

/**
 * Top-level chat surface. Keeps its shell mounted across conversation
 * switches (so `<AccountSelector>` and the panel state survive) by taking
 * `chatRef` directly and loading the conversation through `useChat` —
 * `<ChatHeader>` renders a skeleton while the chat is being fetched.
 */
export const ChatView = ({
  chatRef,
  renderHeader,
  renderEmpty,
  onSent,
  composerFocusSignal,
}: ChatViewProps) => {
  const { t } = useTranslation();
  const { chat } = useChat(chatRef);
  // A pending incoming invitation replaces the timeline/composer/tools surfaces
  // with the invitation detail view until it is accepted.
  const invitationChat = isInvitationChat(chat) ? chat : null;
  const isInvitation = invitationChat !== null;
  const {
    sendMessage,
    isSending: isSendingMessage,
    isSupported: isCompositionSupported,
  } = useSendChatMessage(chatRef);
  const { editMessage, isEditing } = useEditChatMessage(chatRef);
  const { users: typingUsers, onTypingActivity } = useChatTyping(chatRef);
  const [editingMessage, setEditingMessage] =
    useState<EditingChatMessage | null>(null);

  // The same composer submits either a new event or an in-place edit. Notify
  // `onSent` only for new messages so editing never changes navigation state.
  const handleSubmit = useCallback(
    async (content: string) => {
      if (editingMessage) {
        const message = await editMessage(editingMessage.id, content);
        setEditingMessage(null);
        return message;
      }
      const message = await sendMessage(content);
      if (chatRef) {
        onSent?.(chatRef);
      }
      return message;
    },
    [chatRef, editMessage, editingMessage, onSent, sendMessage],
  );

  const [activeTool, setActiveTool] = useState<ChatTool | null>(null);
  const [displayedTool, setDisplayedTool] = useState<ChatTool | null>(null);
  // Thread whose detail view is open; `null` keeps the threads tool on its
  // list view.
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [focusThreadComposer, setFocusThreadComposer] = useState(false);
  const [draftThreadRoot, setDraftThreadRoot] =
    useState<DraftThreadRoot | null>(null);
  const [openedDocument, setOpenedDocument] = useState<ChatDocument | null>(
    null,
  );

  useEffect(() => {
    if (activeTool !== null) {
      setDisplayedTool(activeTool);
    }
  }, [activeTool]);

  // A thread id belongs to a single conversation — reset panel state on switch.
  useEffect(() => {
    setOpenedDocument(null);
    setActiveThreadId(null);
    setFocusThreadComposer(false);
    setDraftThreadRoot(null);
    setEditingMessage(null);
  }, [chatRef?.accountId, chatRef?.chatId]);

  const toggleTool = (tool: ChatTool) => {
    const willOpen = activeTool !== tool;
    setActiveTool(willOpen ? tool : null);
    // Opening the threads tool from the header always lands on the list; on
    // close the thread id is left untouched so the detail view does not flash
    // back to the list during the slide-out animation.
    if (willOpen && tool === "threads") {
      setActiveThreadId(null);
      setFocusThreadComposer(false);
    }
  };

  const closePanel = () => setActiveTool(null);

  const closePreview = () => setOpenedDocument(null);

  const openThread = useCallback(
    (threadId: string, options?: OpenThreadOptions) => {
      setActiveTool("threads");
      setActiveThreadId(threadId);
      setFocusThreadComposer(Boolean(options?.focusComposer));
      setDraftThreadRoot(null);
    },
    [],
  );

  const openThreadList = useCallback(() => {
    setActiveTool("threads");
    setActiveThreadId(null);
    setFocusThreadComposer(false);
    setDraftThreadRoot(null);
  }, []);

  const openDraftThread = useCallback((root: DraftThreadRoot) => {
    setActiveTool("threads");
    setActiveThreadId(null);
    setFocusThreadComposer(false);
    setDraftThreadRoot(root);
  }, []);

  const closeThread = useCallback(() => {
    setActiveThreadId(null);
    setFocusThreadComposer(false);
    setDraftThreadRoot(null);
  }, []);

  const panelContext = useMemo<ChatPanelContextValue>(
    () => ({ openThread, openDraftThread, openThreadList }),
    [openDraftThread, openThread, openThreadList],
  );
  const editContext = useMemo(() => ({ startEditing: setEditingMessage }), []);

  return (
    <ChatMessageEditProvider value={editContext}>
      <ChatPanelProvider value={panelContext}>
        <div
          className="hub__chat-view"
          data-panel-open={activeTool !== null}
          data-header-variant={renderHeader ? "search" : "chat"}
        >
          {renderHeader ? (
            <>
              {renderHeader({
                chat,
                activeTool,
                onToggleTool: toggleTool,
              })}
            </>
          ) : (
            <>
              <ChatHeader
                chat={chat}
                activeTool={activeTool}
                onToggleTool={toggleTool}
                showTools={!isInvitation}
              />
            </>
          )}

          <div className="hub__chat-view__main">
            <div className="hub__chat-view__content">
              {invitationChat && chatRef ? (
                <ChatInvitationView chatRef={chatRef} chat={invitationChat} />
              ) : chatRef ? (
                <ChatConversation chatRef={chatRef} />
              ) : (
                renderEmpty?.()
              )}
            </div>
            {/* An invitation suppresses the composer until it is accepted. */}
            {!isInvitation && (
              <div className="hub__chat-view__composer">
                {/* The composer keeps a single instance across the empty → chat
                  transition so an in-progress draft and the input focus survive
                  when a conversation resolves. */}
                <div className="hub__chat-composer-stack">
                  {chatRef ? (
                    <ConversationUnreadBanner chatRef={chatRef} />
                  ) : null}
                  <TypingIndicator users={typingUsers} />
                  <ChatComposer
                    conversationId={
                      chatRef
                        ? `${chatRef.accountId}:${chatRef.chatId}`
                        : undefined
                    }
                    placeholder={
                      chatRef && !isCompositionSupported
                        ? t(
                            "Sending messages isn't available on this account yet.",
                          )
                        : undefined
                    }
                    disabled={!chatRef || !isCompositionSupported}
                    isSubmitting={isSendingMessage || isEditing}
                    focusSignal={composerFocusSignal}
                    errorMessage={
                      editingMessage
                        ? t(
                            "Your message could not be edited. Please try again.",
                          )
                        : undefined
                    }
                    editDraft={editingMessage}
                    onCancelEdit={() => setEditingMessage(null)}
                    onTypingActivity={onTypingActivity}
                    onSubmit={chatRef ? handleSubmit : undefined}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="hub__chat-view__panel">
            {chatRef && !isInvitation && (
              <ChatToolsPanel
                tool={activeTool ?? displayedTool}
                isOpen={activeTool !== null}
                chatRef={chatRef}
                threadId={activeThreadId}
                focusThreadComposer={focusThreadComposer}
                draftThreadRoot={draftThreadRoot}
                onClose={closePanel}
                onOpenThread={openThread}
                onCloseThread={closeThread}
                onOpenFile={setOpenedDocument}
              />
            )}
          </div>
          <FilePreview
            isOpen={openedDocument !== null}
            onClose={closePreview}
            files={
              openedDocument ? [documentToPreviewFile(openedDocument)] : []
            }
            openedFileId={openedDocument?.id}
          />
        </div>
      </ChatPanelProvider>
    </ChatMessageEditProvider>
  );
};

const ConversationUnreadBanner = ({ chatRef }: { chatRef: ChatRef }) => {
  const { unreadThreads } = useChatThreads(chatRef);

  if (unreadThreads.length === 0) {
    return null;
  }

  return (
    <UnreadThreadsBanner chatRef={chatRef} unreadThreads={unreadThreads} />
  );
};
