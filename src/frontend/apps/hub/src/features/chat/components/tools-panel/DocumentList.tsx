import { Fragment } from 'react';

import { DocumentListItem } from './DocumentListItem';
import type { MockDocument } from './mockDocuments';

type DocumentListProps = {
  documents: MockDocument[];
};

export const DocumentList = ({ documents }: DocumentListProps) => {
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
          <DocumentListItem document={document} />
        </Fragment>
      ))}
    </ul>
  );
};
