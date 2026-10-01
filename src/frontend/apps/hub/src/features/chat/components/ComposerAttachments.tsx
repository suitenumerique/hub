import { FileIcon, IconSize } from "@gouvfr-lasuite/ui-components";
import {
  Loader,
  Retry,
  WarningFilled,
  XMark,
} from "@gouvfr-lasuite/ui-components/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { PendingAttachment } from "../hooks/usePendingAttachments";

type ComposerAttachmentsProps = {
  items: PendingAttachment[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

type ComposerAttachmentProps = {
  item: PendingAttachment;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  /** Localized "42 %"-style upload progress. */
  formatProgress: (fraction: number) => string;
};

const RemoveButton = ({
  item,
  onRemove,
}: Pick<ComposerAttachmentProps, "item" | "onRemove">) => {
  const { t } = useTranslation();
  return (
    <span className="hub__composer-attachment__remove">
      <button
        type="button"
        className="hub__composer-attachment__icon-button"
        aria-label={t("Remove {{name}}", { name: item.file.name })}
        onClick={() => onRemove(item.id)}
      >
        <XMark size={16} aria-hidden="true" />
      </button>
    </span>
  );
};

const PendingImage = ({
  item,
  onRemove,
  onRetry,
  formatProgress,
}: ComposerAttachmentProps) => {
  const { t } = useTranslation();
  return (
    <li
      className="hub__composer-attachment hub__composer-attachment--image"
      data-status={item.status}
    >
      {item.status === "ready" && item.previewUrl ? (
        <img
          className="hub__composer-attachment__thumbnail"
          src={item.previewUrl}
          alt={item.file.name}
          draggable={false}
        />
      ) : item.status === "failed" ? (
        <span className="hub__composer-attachment__state">
          <span className="hub__composer-attachment__error">
            <WarningFilled size={16} aria-hidden="true" />
            {t("Upload failed")}
          </span>
          <button
            type="button"
            className="hub__composer-attachment__retry"
            aria-label={t("Retry uploading {{name}}", { name: item.file.name })}
            onClick={() => onRetry(item.id)}
          >
            <Retry size={16} aria-hidden="true" />
            {t("Retry")}
          </button>
        </span>
      ) : (
        <span className="hub__composer-attachment__state">
          <span className="hub__composer-attachment__uploading">
            <Loader
              className="hub__spinning-icon"
              size={16}
              aria-hidden="true"
            />
            {t("Uploading")}
            {item.status === "uploading" && item.progress > 0 && (
              <span className="hub__composer-attachment__progress">
                {formatProgress(item.progress)}
              </span>
            )}
          </span>
        </span>
      )}
      <RemoveButton item={item} onRemove={onRemove} />
    </li>
  );
};

const PendingFile = ({
  item,
  onRemove,
  onRetry,
  formatProgress,
}: ComposerAttachmentProps) => {
  const { t } = useTranslation();
  return (
    <li
      className="hub__composer-attachment hub__composer-attachment--file"
      data-status={item.status}
    >
      {item.status === "uploading" ? (
        <Loader className="hub__spinning-icon" size={16} aria-hidden="true" />
      ) : item.status === "failed" ? (
        <WarningFilled
          className="hub__composer-attachment__error"
          size={16}
          aria-label={t("Upload failed")}
        />
      ) : (
        <FileIcon
          file={{
            mimetype: item.file.type || "application/octet-stream",
            title: item.file.name,
          }}
          type="mini"
          size={IconSize.SMALL}
        />
      )}
      <span className="hub__composer-attachment__name" title={item.file.name}>
        {item.file.name}
      </span>
      {item.status === "uploading" && item.progress > 0 && (
        <span className="hub__composer-attachment__progress">
          {formatProgress(item.progress)}
        </span>
      )}
      {item.status === "failed" && (
        <button
          type="button"
          className="hub__composer-attachment__icon-button"
          aria-label={t("Retry uploading {{name}}", { name: item.file.name })}
          onClick={() => onRetry(item.id)}
        >
          <Retry size={16} aria-hidden="true" />
        </button>
      )}
      <RemoveButton item={item} onRemove={onRemove} />
    </li>
  );
};

/**
 * Files queued in the composer before sending: image thumbnails on a first
 * row, other files as chips below. Hovering one reveals its remove button; a
 * failed upload shows its retry action.
 */
export const ComposerAttachments = ({
  items,
  onRemove,
  onRetry,
}: ComposerAttachmentsProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const formatProgress = useMemo(() => {
    const format = new Intl.NumberFormat(language, {
      style: "percent",
      maximumFractionDigits: 0,
    });
    return (fraction: number) => format.format(fraction);
  }, [language]);
  const images = items.filter((item) => item.isImage);
  const files = items.filter((item) => !item.isImage);
  const uploadingCount = items.filter(
    (item) => item.status === "uploading",
  ).length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const status = [
    uploadingCount === 1
      ? t("Uploading 1 file")
      : uploadingCount > 1
        ? t("Uploading {{count}} files", { count: uploadingCount })
        : "",
    failedCount === 1
      ? t("1 file could not be uploaded")
      : failedCount > 1
        ? t("{{count}} files could not be uploaded", { count: failedCount })
        : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (items.length === 0) {
    return null;
  }

  const itemProps = { onRemove, onRetry, formatProgress };
  return (
    <div className="hub__composer-attachments">
      {images.length > 0 && (
        <ul
          className="hub__composer-attachments__list"
          aria-label={t("Attached images")}
        >
          {images.map((item) => (
            <PendingImage key={item.id} item={item} {...itemProps} />
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul
          className="hub__composer-attachments__list"
          aria-label={t("Attached files")}
        >
          {files.map((item) => (
            <PendingFile key={item.id} item={item} {...itemProps} />
          ))}
        </ul>
      )}
      <span className="c__offscreen" role="status">
        {status}
      </span>
    </div>
  );
};
