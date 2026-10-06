import {
  Button,
  FileIcon,
  FilePreview,
  type FilePreviewType,
  getExtensionFromName,
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

import {
  formatFileSize,
  isPreviewableAttachment,
  isSvgAttachment,
} from "../attachments";
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

/** What the preview's information panel tells about the file. */
const AttachmentDetails = ({
  attachment,
  senderName,
  sentAt,
}: Pick<PreviewedAttachment, "attachment" | "senderName" | "sentAt">) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const extension = getExtensionFromName(attachment.name);
  const sentDate = new Date(sentAt);
  const rows: [label: string, value: string][] = [
    [t("Name"), attachment.name],
    [t("Type"), extension ? extension.toUpperCase() : attachment.mimetype],
  ];
  if (attachment.size !== undefined) {
    rows.push([t("Size"), formatFileSize(attachment.size, locale)]);
  }
  rows.push([t("Sent by"), senderName]);
  if (!Number.isNaN(sentDate.getTime())) {
    const format = new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeStyle: "short",
    });
    rows.push([t("Sent on"), format.format(sentDate)]);
  }

  return (
    <section className="hub__attachment-details">
      <h2 className="hub__attachment-details__title">{t("File details")}</h2>
      <dl className="hub__attachment-details__list">
        {rows.map(([label, value]) => (
          <div key={label} className="hub__attachment-details__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
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
  senderName,
  sentAt,
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
      sidebarContent={
        <AttachmentDetails
          attachment={attachment}
          senderName={senderName}
          sentAt={sentAt}
        />
      }
    />
  );
};
