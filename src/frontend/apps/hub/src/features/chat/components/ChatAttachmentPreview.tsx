import {
  Button,
  FileIcon,
  FilePreview,
  type FilePreviewType,
  Icon,
  IconSize,
  Modal,
  ModalSize,
  removeFileExtension,
  Spinner,
} from "@gouvfr-lasuite/ui-components";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ChatAttachment } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { isPreviewableAttachment, isSvgAttachment } from "../attachments";
import type { PreviewedAttachment } from "../ChatAttachmentPreviewContext";
import { useDownloadChatAttachment } from "../hooks/useChatAttachmentActions";
import { useChatAttachmentUrl } from "../hooks/useChatAttachmentUrl";

type ChatAttachmentPreviewProps = PreviewedAttachment & {
  onClose: () => void;
};

/**
 * Opens with the click, laid out like the design-system preview it hands
 * over to, so a slow download never opens a dialog later on its own. Closing
 * it cancels the download: its query loses its only observer.
 */
const LoadingPreview = ({
  attachment,
  onClose,
}: {
  attachment: ChatAttachment;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen
      onClose={onClose}
      size={ModalSize.FULL}
      hideCloseButton
      aria-label={attachment.name}
    >
      <div className="file-preview__container">
        <div className="file-preview__header">
          <div className="file-preview__header__content">
            <div className="file-preview__header__content__left">
              <Button
                variant="tertiary"
                size="small"
                aria-label={t("Close")}
                icon={<Icon name="close" />}
                onClick={onClose}
              />
              <div className="file-preview__title-wrapper">
                <FileIcon
                  file={{
                    mimetype: attachment.mimetype,
                    title: attachment.name,
                  }}
                  type="mini"
                  size={IconSize.SMALL}
                />
                <h1 className="file-preview__title">
                  {removeFileExtension(attachment.name)}
                </h1>
              </div>
            </div>
          </div>
        </div>
        <div className="file-preview__content">
          <div
            className="file-preview__main hub__attachment-preview-loading"
            role="status"
          >
            <Spinner size="xl" />
            <span className="c__offscreen">
              {t("Loading {{name}}", { name: attachment.name })}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

/**
 * The design-system file preview for one attachment, behind a loading view
 * until the bytes it needs are available.
 */
export const ChatAttachmentPreview = ({
  accountId,
  messageId,
  attachment,
  onClose,
}: ChatAttachmentPreviewProps) => {
  const { t } = useTranslation();
  const download = useDownloadChatAttachment(accountId);
  const isPreviewable = isPreviewableAttachment(attachment);
  // Images wait for their original too: the preview fits an image once, from
  // its natural size, and never upscales one smaller than the screen. Opening
  // on the smaller timeline thumbnail would show it small, then jump.
  const original = useChatAttachmentUrl(
    accountId,
    attachment,
    "original",
    isPreviewable,
  );
  const previewUrl = original.url;

  useEffect(() => {
    if (original.isError && !previewUrl) {
      notify.error(t("The file could not be opened. Please try again."));
      onClose();
    }
  }, [onClose, original.isError, previewUrl, t]);

  const files = useMemo<FilePreviewType[]>(
    () => [
      {
        id: messageId,
        title: attachment.name,
        // The preview would try to render an SVG as an image: present it as
        // an unsupported file offered for download instead.
        mimetype: isSvgAttachment(attachment)
          ? "application/octet-stream"
          : attachment.mimetype,
        size: attachment.size ?? 0,
        url_preview: previewUrl ?? "",
        url: previewUrl ?? "",
      },
    ],
    [attachment, messageId, previewUrl],
  );

  if (isPreviewable && !previewUrl) {
    return <LoadingPreview attachment={attachment} onClose={onClose} />;
  }
  return (
    <FilePreview
      isOpen
      files={files}
      openedFileId={messageId}
      onClose={onClose}
      handleDownloadFile={() => void download(attachment)}
    />
  );
};
