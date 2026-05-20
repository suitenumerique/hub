import { FilePreview } from '@gouvfr-lasuite/ui-kit';
import { useEffect, useState } from 'react';

import type { MockChat } from '@/features/chat/mockChats';
import type { ChatDocument } from '@/features/drivers/types';

import { ChatConversation } from './ChatConversation';
import { ChatHeader } from './header/ChatHeader';
import { ChatToolsPanel, ChatTool } from './tools-panel/ChatToolsPanel';
import { documentToPreviewFile } from './tools-panel/documentToPreviewFile';

type ChatViewProps = {
  chat: MockChat;
};

export const ChatView = ({ chat }: ChatViewProps) => {
  const [activeTool, setActiveTool] = useState<ChatTool | null>(null);
  const [displayedTool, setDisplayedTool] = useState<ChatTool | null>(null);
  const [openedDocument, setOpenedDocument] = useState<ChatDocument | null>(
    null,
  );

  useEffect(() => {
    if (activeTool !== null) {
      setDisplayedTool(activeTool);
    }
  }, [activeTool]);

  useEffect(() => {
    setOpenedDocument(null);
  }, [chat.id]);

  const toggleTool = (tool: ChatTool) => {
    setActiveTool((current) => (current === tool ? null : tool));
  };

  const closePanel = () => setActiveTool(null);

  const closePreview = () => setOpenedDocument(null);

  return (
    <div className="hub__chat-view" data-panel-open={activeTool !== null}>
      <ChatHeader
        chat={chat}
        activeTool={activeTool}
        onToggleTool={toggleTool}
      />
      <div className="hub__chat-view__main">
        <ChatConversation chatId={chat.id} />
      </div>
      <div className="hub__chat-view__panel">
        <ChatToolsPanel
          tool={activeTool ?? displayedTool}
          isOpen={activeTool !== null}
          chatId={chat.id}
          onClose={closePanel}
          onOpenFile={setOpenedDocument}
        />
      </div>
      <FilePreview
        isOpen={openedDocument !== null}
        onClose={closePreview}
        files={openedDocument ? [documentToPreviewFile(openedDocument)] : []}
        openedFileId={openedDocument?.id}
      />
    </div>
  );
};
