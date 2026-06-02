import { useTranslation } from "react-i18next";

import { useChatDocuments } from "@/features/chat/hooks/useChatDocuments";
import type { ChatDocument } from "@/features/drivers/types";

import { DocumentList } from "./DocumentList";
import { CollapsibleSection, PinnedSection } from "./DocumentSection";

type DocumentsToolProps = {
  chatId: string;
  onOpenFile?: (doc: ChatDocument) => void;
};

type SectionBodyProps = {
  documents: ChatDocument[];
  onOpenFile?: (doc: ChatDocument) => void;
};

const SectionBody = ({ documents, onOpenFile }: SectionBodyProps) => {
  const { t } = useTranslation();

  if (documents.length === 0) {
    return (
      <p className="hub__chat-tools-panel__empty">{t("No documents yet")}</p>
    );
  }

  return <DocumentList documents={documents} onOpenFile={onOpenFile} />;
};

export const DocumentsTool = ({ chatId, onOpenFile }: DocumentsToolProps) => {
  const { t } = useTranslation();
  const { pinned, shared, multimedia, isInitialLoading, isError, refetch } =
    useChatDocuments(chatId);

  if (isInitialLoading) {
    return (
      <div className="hub__chat-tools-panel__content">
        <p className="hub__chat-tools-panel__state" role="status">
          {t("Loading documents…")}
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="hub__chat-tools-panel__content">
        <div className="hub__chat-tools-panel__state" role="alert">
          <p>{t("Documents could not be loaded.")}</p>
          <button
            type="button"
            className="hub__chat-tools-panel__state__retry"
            onClick={refetch}
          >
            {t("Retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hub__chat-tools-panel__content">
      <PinnedSection title={t("Pinned")}>
        <SectionBody documents={pinned} onOpenFile={onOpenFile} />
      </PinnedSection>
      <CollapsibleSection title={t("Shared Files")}>
        <SectionBody documents={shared} onOpenFile={onOpenFile} />
      </CollapsibleSection>
      <CollapsibleSection title={t("Multimedia")}>
        <SectionBody documents={multimedia} onOpenFile={onOpenFile} />
      </CollapsibleSection>
    </div>
  );
};
