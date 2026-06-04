import { FilePreview } from "@gouvfr-lasuite/ui-kit";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import type { Chat, ChatDocument, ChatRef } from "@/features/drivers/types";

import {
  ChatPanelProvider,
  type ChatPanelContextValue,
} from "../ChatPanelContext";
import { useChat } from "../hooks/useChat";
import { useChatThreads } from "../hooks/useChatThreads";

import { ChatComposer } from "./ChatComposer";
import { ChatConversation } from "./ChatConversation";
import { ChatHeader } from "./header/ChatHeader";
import { ChatToolsPanel, ChatTool } from "./tools-panel/ChatToolsPanel";
import { documentToPreviewFile } from "./tools-panel/documentToPreviewFile";
import { UnreadThreadsBanner } from "./UnreadThreadsBanner";

type ChatViewProps = {
  chatRef: ChatRef | null;
  renderHeader?: (props: {
    chat: Chat | null;
    activeTool: ChatTool | null;
    onToggleTool: (tool: ChatTool) => void;
  }) => ReactNode;
  /** Rendered in the main area when there is no conversation yet. */
  renderEmpty?: () => ReactNode;
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
}: ChatViewProps) => {
  const { chat } = useChat(chatRef);

  const [activeTool, setActiveTool] = useState<ChatTool | null>(null);
  const [displayedTool, setDisplayedTool] = useState<ChatTool | null>(null);
  // Thread whose detail view is open; `null` keeps the threads tool on its
  // list view.
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
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
  }, [chatRef?.accountId, chatRef?.chatId]);

  const toggleTool = (tool: ChatTool) => {
    const willOpen = activeTool !== tool;
    setActiveTool(willOpen ? tool : null);
    // Opening the threads tool from the header always lands on the list; on
    // close the thread id is left untouched so the detail view does not flash
    // back to the list during the slide-out animation.
    if (willOpen && tool === "threads") {
      setActiveThreadId(null);
    }
  };

  const closePanel = () => setActiveTool(null);

  const closePreview = () => setOpenedDocument(null);

  const openThread = useCallback((threadId: string) => {
    setActiveTool("threads");
    setActiveThreadId(threadId);
  }, []);

  const openThreadList = useCallback(() => {
    setActiveTool("threads");
    setActiveThreadId(null);
  }, []);

  const closeThread = useCallback(() => setActiveThreadId(null), []);

  const panelContext = useMemo<ChatPanelContextValue>(
    () => ({ openThread, openThreadList }),
    [openThread, openThreadList],
  );

  return (
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
            />
          </>
        )}

        <div className="hub__chat-view__main">
          <div className="hub__chat-view__content">
            {chatRef ? <ChatConversation chatRef={chatRef} /> : renderEmpty?.()}
          </div>
          <div className="hub__chat-view__composer">
            {/* The composer keeps a single instance across the empty → chat
                transition so an in-progress draft and the input focus survive
                when a conversation resolves. */}
            <div className="hub__chat-composer-stack">
              {chatRef ? <ConversationUnreadBanner chatRef={chatRef} /> : null}
              <ChatComposer />
            </div>
          </div>
        </div>
        <div className="hub__chat-view__panel">
          {chatRef && (
            <ChatToolsPanel
              tool={activeTool ?? displayedTool}
              isOpen={activeTool !== null}
              chatRef={chatRef}
              threadId={activeThreadId}
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
          files={openedDocument ? [documentToPreviewFile(openedDocument)] : []}
          openedFileId={openedDocument?.id}
        />
      </div>
    </ChatPanelProvider>
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
