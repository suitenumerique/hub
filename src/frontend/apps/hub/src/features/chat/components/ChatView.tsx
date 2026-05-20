import { FilePreview } from '@gouvfr-lasuite/ui-kit';
import { useEffect, useMemo, useState } from 'react';

import type { MockChat } from '@/features/chat/mockChats';

import { ChatConversation } from './ChatConversation';
import { ChatHeader } from './header/ChatHeader';
import { ChatToolsPanel, ChatTool } from './tools-panel/ChatToolsPanel';
import {
  findMockDocumentById,
  mockDocumentToPreviewFile,
  type MockDocument,
} from './tools-panel/mockDocuments';

type ChatViewProps = {
  chat: MockChat;
};

export const ChatView = ({ chat }: ChatViewProps) => {
  const [activeTool, setActiveTool] = useState<ChatTool | null>(null);
  const [displayedTool, setDisplayedTool] = useState<ChatTool | null>(null);
  const [openedFileId, setOpenedFileId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTool !== null) {
      setDisplayedTool(activeTool);
    }
  }, [activeTool]);

  useEffect(() => {
    setOpenedFileId(null);
  }, [chat.id]);

  const toggleTool = (tool: ChatTool) => {
    setActiveTool((current) => (current === tool ? null : tool));
  };

  const closePanel = () => setActiveTool(null);

  const handleOpenFile = (doc: MockDocument) => {
    setOpenedFileId(doc.id);
  };

  const closePreview = () => setOpenedFileId(null);

  const previewFiles = useMemo(() => {
    if (openedFileId === null) {
      return [];
    }
    const doc = findMockDocumentById(openedFileId);
    return doc ? [mockDocumentToPreviewFile(doc)] : [];
  }, [openedFileId]);

  const isPreviewOpen = openedFileId !== null && previewFiles.length > 0;

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
          onClose={closePanel}
          onOpenFile={handleOpenFile}
        />
      </div>
      <FilePreview
        isOpen={isPreviewOpen}
        onClose={closePreview}
        files={previewFiles}
        openedFileId={openedFileId ?? undefined}
      />
    </div>
  );
};
