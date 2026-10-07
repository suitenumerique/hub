import { FileIcon, IconSize } from "@gouvfr-lasuite/ui-components";
import {
  Loader,
  Retry,
  WarningFilled,
  XMark,
} from "@gouvfr-lasuite/ui-components/icons";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { PendingAttachment } from "../hooks/usePendingAttachments";

type ComposerAttachmentsProps = {
  items: PendingAttachment[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  /** Explains why the last files added were refused. */
  limitNotice?: string;
};

type ComposerAttachmentProps = {
  item: PendingAttachment;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  /** Localized "42 %"-style upload progress. */
  formatProgress: (fraction: number) => string;
  /** Several files are queued: the tile shrinks to a small square. */
  compact: boolean;
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

const PendingImageState = ({
  item,
  onRetry,
  formatProgress,
  compact,
}: Omit<ComposerAttachmentProps, "onRemove">) => {
  const { t } = useTranslation();
  if (item.status === "ready" && item.previewUrl) {
    return (
      <img
        className="hub__composer-attachment__thumbnail"
        src={item.previewUrl}
        alt={item.file.name}
        draggable={false}
      />
    );
  }
  if (compact && item.status === "failed") {
    // No room for the wording in a small tile: icons only.
    return (
      <span className="hub__composer-attachment__state">
        <WarningFilled
          className="hub__composer-attachment__error"
          size={16}
          aria-label={t("Upload failed")}
        />
        <button
          type="button"
          className="hub__composer-attachment__icon-button"
          aria-label={t("Retry uploading {{name}}", { name: item.file.name })}
          onClick={() => onRetry(item.id)}
        >
          <Retry size={16} aria-hidden="true" />
        </button>
      </span>
    );
  }
  if (compact) {
    return (
      <span className="hub__composer-attachment__state">
        <Loader
          className="hub__spinning-icon"
          size={16}
          aria-label={t("Uploading")}
        />
        {item.status === "uploading" && item.progress > 0 && (
          <span className="hub__composer-attachment__progress">
            {formatProgress(item.progress)}
          </span>
        )}
      </span>
    );
  }
  if (item.status === "failed") {
    return (
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
    );
  }
  return (
    <span className="hub__composer-attachment__state">
      <span className="hub__composer-attachment__uploading">
        <Loader className="hub__spinning-icon" size={16} aria-hidden="true" />
        {t("Uploading")}
        {item.status === "uploading" && item.progress > 0 && (
          <span className="hub__composer-attachment__progress">
            {formatProgress(item.progress)}
          </span>
        )}
      </span>
    </span>
  );
};

const PendingImage = ({ onRemove, ...props }: ComposerAttachmentProps) => (
  <li
    className="hub__composer-attachment hub__composer-attachment--image"
    data-status={props.item.status}
  >
    <PendingImageState {...props} />
    <RemoveButton item={props.item} onRemove={onRemove} />
  </li>
);

const PendingFileIcon = ({ item }: Pick<ComposerAttachmentProps, "item">) => {
  const { t } = useTranslation();
  if (item.status === "uploading") {
    return (
      <Loader className="hub__spinning-icon" size={16} aria-hidden="true" />
    );
  }
  if (item.status === "failed") {
    return (
      <WarningFilled
        className="hub__composer-attachment__error"
        size={16}
        aria-label={t("Upload failed")}
      />
    );
  }
  return (
    <FileIcon
      file={{
        mimetype: item.file.type || "application/octet-stream",
        title: item.file.name,
      }}
      type="mini"
      size={IconSize.SMALL}
    />
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
      <PendingFileIcon item={item} />
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
 * Files queued in the composer before sending, in the order they will be
 * sent: image thumbnails and file chips on one row that scrolls sideways, so
 * the text field always stays in view. Past one file, thumbnails shrink to
 * small squares. Hovering one reveals its remove button; a failed upload
 * shows its retry action.
 */
export const ComposerAttachments = ({
  items,
  onRemove,
  onRetry,
  limitNotice,
}: ComposerAttachmentsProps) => {
  const { t, i18n } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);
  const previousCount = useRef(items.length);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const formatProgress = useMemo(() => {
    const format = new Intl.NumberFormat(language, {
      style: "percent",
      maximumFractionDigits: 0,
    });
    return (fraction: number) => format.format(fraction);
  }, [language]);

  // Bring the files just added into view, at the end of the row.
  useEffect(() => {
    const list = listRef.current;
    if (list && items.length > previousCount.current) {
      list.scrollLeft = list.scrollWidth;
    }
    previousCount.current = items.length;
  }, [items.length]);

  const uploadingCount = items.filter(
    (item) => item.status === "uploading",
  ).length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const uploadingStatus = t("Uploading {{count}} files", {
    count: uploadingCount,
  });
  const failedStatus = t("{{count}} files could not be uploaded", {
    count: failedCount,
  });
  const status = [
    uploadingCount > 0 ? uploadingStatus : "",
    failedCount > 0 ? failedStatus : "",
    limitNotice ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (items.length === 0) {
    return null;
  }

  const compact = items.length > 1;
  const itemProps = { onRemove, onRetry, formatProgress, compact };
  return (
    <div className="hub__composer-attachments">
      {limitNotice && (
        // Announced through the status below.
        <p className="hub__composer-attachments__notice" aria-hidden="true">
          <WarningFilled size={16} aria-hidden="true" />
          {limitNotice}
        </p>
      )}
      <ul
        ref={listRef}
        className="hub__composer-attachments__list"
        data-compact={compact || undefined}
        aria-label={t("Attached files")}
      >
        {items.map((item) =>
          item.isImage ? (
            <PendingImage key={item.id} item={item} {...itemProps} />
          ) : (
            <PendingFile key={item.id} item={item} {...itemProps} />
          ),
        )}
      </ul>
      <span className="c__offscreen" role="status">
        {status}
      </span>
    </div>
  );
};
