import { Fragment } from 'react';

import type { ChatDocument } from '@/features/drivers/types';

import { DocumentListItem } from './DocumentListItem';

type DocumentListProps = {
  documents: ChatDocument[];
  onOpenFile?: (doc: ChatDocument) => void;
};

export const DocumentList = ({ documents, onOpenFile }: DocumentListProps) => {
  return (
    <ul className="hub__chat-tools-panel__list">
      {documents.map((document, index) => (
        <Fragment key={document.id}>
          {index > 0 && (
            <li
              role="separator"
              className="hub__chat-tools-panel__separator"
              aria-hidden="true"
            />
          )}
          <DocumentListItem document={document} onOpenFile={onOpenFile} />
        </Fragment>
      ))}
    </ul>
  );
};
