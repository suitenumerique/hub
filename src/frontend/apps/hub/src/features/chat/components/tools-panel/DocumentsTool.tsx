import { useTranslation } from 'react-i18next';

import { DocumentList } from './DocumentList';
import { CollapsibleSection, PinnedSection } from './DocumentSection';
import {
  MOCK_MULTIMEDIA,
  MOCK_PINNED,
  MOCK_SHARED_FILES,
  type MockDocument,
} from './mockDocuments';

type DocumentsToolProps = {
  onOpenFile?: (doc: MockDocument) => void;
};

export const DocumentsTool = ({ onOpenFile }: DocumentsToolProps) => {
  const { t } = useTranslation();

  return (
    <div className="hub__chat-tools-panel__content">
      <PinnedSection title={t('Pinned')}>
        <DocumentList documents={MOCK_PINNED} onOpenFile={onOpenFile} />
      </PinnedSection>
      <CollapsibleSection title={t('Shared Files')}>
        <DocumentList documents={MOCK_SHARED_FILES} onOpenFile={onOpenFile} />
      </CollapsibleSection>
      <CollapsibleSection title={t('Multimedia')}>
        <DocumentList documents={MOCK_MULTIMEDIA} onOpenFile={onOpenFile} />
      </CollapsibleSection>
    </div>
  );
};
