import { useTranslation } from 'react-i18next';

import { DocumentList } from './DocumentList';
import { CollapsibleSection, PinnedSection } from './DocumentSection';
import {
  MOCK_MULTIMEDIA,
  MOCK_PINNED,
  MOCK_SHARED_FILES,
} from './mockDocuments';

export const DocumentsTool = () => {
  const { t } = useTranslation();

  return (
    <div className="hub__chat-tools-panel__content">
      <PinnedSection title={t('Pinned')}>
        <DocumentList documents={MOCK_PINNED} />
      </PinnedSection>
      <CollapsibleSection title={t('Shared Files')}>
        <DocumentList documents={MOCK_SHARED_FILES} />
      </CollapsibleSection>
      <CollapsibleSection title={t('Multimedia')}>
        <DocumentList documents={MOCK_MULTIMEDIA} />
      </CollapsibleSection>
    </div>
  );
};
