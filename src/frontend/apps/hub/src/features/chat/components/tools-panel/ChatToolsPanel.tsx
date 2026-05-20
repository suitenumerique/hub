import { XMark } from '@gouvfr-lasuite/ui-kit/icons';
import { useTranslation } from 'react-i18next';

import type { ChatDocument } from '@/features/drivers/types';

import { DocumentsTool } from './DocumentsTool';

export type ChatTool = 'threads' | 'files';

type ChatToolsPanelProps = {
  tool: ChatTool | null;
  isOpen: boolean;
  chatId: string;
  onClose: () => void;
  onOpenFile?: (doc: ChatDocument) => void;
};

const TOOL_TITLE_KEYS: Record<ChatTool, string> = {
  threads: 'Threads',
  files: 'Documents',
};

export const ChatToolsPanel = ({
  tool,
  isOpen,
  chatId,
  onClose,
  onOpenFile,
}: ChatToolsPanelProps) => {
  const { t } = useTranslation();
  const title = tool ? t(TOOL_TITLE_KEYS[tool]) : '';

  return (
    <aside
      className="hub__chat-tools-panel"
      aria-label={title || t('Tools panel')}
      aria-hidden={!isOpen}
    >
      <div className="hub__chat-tools-panel__header">
        <h2 className="hub__chat-tools-panel__title">{title}</h2>
        <button
          type="button"
          className="hub__chat-tools-panel__close"
          onClick={onClose}
          aria-label={t('Close panel')}
          tabIndex={isOpen ? 0 : -1}
        >
          <XMark />
        </button>
      </div>
      {tool === 'files' && (
        <DocumentsTool chatId={chatId} onOpenFile={onOpenFile} />
      )}
    </aside>
  );
};
