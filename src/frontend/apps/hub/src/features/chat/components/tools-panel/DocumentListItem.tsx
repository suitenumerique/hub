import { FileIcon } from '@gouvfr-lasuite/ui-kit';
import { FolderDrive, Globe2, Link } from '@gouvfr-lasuite/ui-kit/icons';
import { useTranslation } from 'react-i18next';

import type { MockDocument } from '@/features/chat/components/tools-panel/mockDocuments';
import { DocumentListItemActions } from './DocumentListItemActions';

type DocumentListItemProps = {
  document: MockDocument;
  active?: boolean;
};

export const DocumentListItem = ({
  document,
  active = false,
}: DocumentListItemProps) => {
  const { t } = useTranslation();

  return (
    <li
      className="hub__chat-tools-panel__list-item"
      data-active={active || undefined}
    >
      <button
        type="button"
        className="hub__chat-tools-panel__list-item__button"
      >
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
      </button>
      <div className="hub__chat-tools-panel__list-item__actions">
        <DocumentListItemActions document={document} />
      </div>
    </li>
  );
};
