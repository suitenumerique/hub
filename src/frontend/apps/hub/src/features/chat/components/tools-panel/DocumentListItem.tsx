import { FileIcon } from '@gouvfr-lasuite/ui-kit';
import { FolderDrive, Globe2, Link } from '@gouvfr-lasuite/ui-kit/icons';
import { useTranslation } from 'react-i18next';

import type { ChatDocument } from '@/features/drivers/types';

import { DocumentListItemActions } from './DocumentListItemActions';

type DocumentListItemProps = {
  document: ChatDocument;
  active?: boolean;
  onOpenFile?: (doc: ChatDocument) => void;
};

export const DocumentListItem = ({
  document,
  active = false,
  onOpenFile,
}: DocumentListItemProps) => {
  const { t } = useTranslation();

  const handleClick = () => {
    if (document.kind === 'file') {
      onOpenFile?.(document);
    }
  };

  const content = (
    <>
      <span
        className="hub__chat-tools-panel__list-item__icon"
        aria-hidden="true"
      >
        {document.kind === 'folder' ? (
          <FolderDrive />
        ) : document.kind === 'link' ? (
          <Link />
        ) : (
          <FileIcon
            file={{ mimetype: document.mimetype, title: document.title }}
            size={32}
          />
        )}
      </span>
      <span className="hub__chat-tools-panel__list-item__name">
        {document.title}
      </span>
      {document.isShared && (
        <span
          className="hub__chat-tools-panel__list-item__badge"
          aria-label={t('Shared with others')}
        >
          <Globe2 />
        </span>
      )}
    </>
  );

  return (
    <li
      className="hub__chat-tools-panel__list-item"
      data-active={active || undefined}
    >
      {document.kind === 'link' && document.url ? (
        <a
          className="hub__chat-tools-panel__list-item__button"
          href={document.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {content}
        </a>
      ) : (
        <button
          type="button"
          className="hub__chat-tools-panel__list-item__button"
          onClick={handleClick}
        >
          {content}
        </button>
      )}
      <div className="hub__chat-tools-panel__list-item__actions">
        <DocumentListItemActions document={document} />
      </div>
    </li>
  );
};
