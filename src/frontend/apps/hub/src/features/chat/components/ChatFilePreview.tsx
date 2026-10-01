import {
  FilePreview,
  Modal,
  ModalSize,
  type FilePreviewType,
} from "@gouvfr-lasuite/ui-components";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ChatAttachment, ChatRef } from "@/features/drivers/types";
import {
  saveAttachment,
  useChatAttachmentMedia,
} from "../hooks/useChatAttachmentMedia";

export const ChatFilePreview = ({
  chatRef,
  attachment,
  onClose,
}: {
  chatRef: ChatRef;
  attachment: ChatAttachment;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const media = useChatAttachmentMedia(chatRef, attachment, true);
  const files = useMemo<FilePreviewType[]>(
    () => [
      {
        id: attachment.url,
        title: attachment.name,
        mimetype: attachment.mimetype,
        size: attachment.size,
        url: media.url ?? "",
        url_preview: media.url ?? "",
      },
    ],
    [attachment, media.url],
  );
  if (!media.url) {
    return (
      <Modal
        size={ModalSize.MEDIUM}
        isOpen
        onClose={onClose}
        title={attachment.name}
      >
        <div role={media.isError ? "alert" : "status"}>
          {media.isError ? (
            <>
              <p>{t("This file could not be loaded.")}</p>
              <button type="button" onClick={() => void media.refetch()}>
                {t("Retry")}
              </button>
            </>
          ) : (
            t("Loading file…")
          )}
        </div>
      </Modal>
    );
  }
  return (
    <FilePreview
      isOpen
      onClose={onClose}
      files={files}
      initialIndexFile={0}
      openedFileId={attachment.url}
      title={attachment.name}
      pdfWorkerSrc="/pdf.worker.min.mjs"
      handleDownloadFile={() => {
        if (media.data) saveAttachment(media.data, attachment.name);
      }}
    />
  );
};
