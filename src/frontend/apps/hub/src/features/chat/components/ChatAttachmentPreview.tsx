import {
  FilePreview,
  type FilePreviewType,
  getExtensionFromName,
} from "@gouvfr-lasuite/ui-components";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ChatRef } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import {
  formatFileSize,
  isPreviewableAttachment,
  isSvgAttachment,
} from "../attachments";
import type { PreviewedAttachment } from "../ChatAttachmentPreviewContext";
import { useDownloadChatAttachment } from "../hooks/useChatAttachmentActions";
import { useChatAttachmentUrl } from "../hooks/useChatAttachmentUrl";
import { useIsChatMessageDeleted } from "../hooks/useIsChatMessageDeleted";

type ChatAttachmentPreviewProps = PreviewedAttachment & {
  chatRef: ChatRef;
  onClose: () => void;
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
 * The design-system file preview for one attachment, opened once the bytes
 * it needs are downloaded: until then nothing shows but the spinner of its
 * message (the timeline watches the same download), so no loading dialog
 * hands over to the preview. Escape, another file or another conversation
 * cancels the wait — the download loses its only observer. The preview
 * closes should the message be deleted meanwhile.
 */
export const ChatAttachmentPreview = ({
  chatRef,
  accountId,
  messageId,
  attachment,
  senderName,
  sentAt,
  threadId,
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
  const isReady = !isPreviewable || previewUrl !== undefined;
  const isDeleted = useIsChatMessageDeleted(chatRef, threadId, messageId);

  useEffect(() => {
    if (isDeleted) {
      onClose();
    }
  }, [isDeleted, onClose]);

  useEffect(() => {
    if (original.isError && !isReady) {
      notify.error(t("The file could not be opened. Please try again."));
      onClose();
    }
  }, [isReady, onClose, original.isError, t]);

  // Nothing is on screen yet to close: Escape cancels the wait.
  useEffect(() => {
    if (isReady) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isReady, onClose]);

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

  if (!isReady || isDeleted) {
    return null;
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
