import { FileIcon } from "@gouvfr-lasuite/ui-components";
import { Loader, XMark } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";
import type { ComposerAttachment } from "../hooks/useComposerAttachments";

export const ComposerAttachments = ({
  entries,
  disabled,
  onRemove,
  onRetry,
}: {
  entries: ComposerAttachment[];
  disabled: boolean;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="hub__composer-attachments" aria-label={t("Attachments")}>
      {[true, false].map((images) => (
        <div key={String(images)} className="hub__composer-attachments__row">
          {entries
            .filter((entry) => Boolean(entry.previewUrl) === images)
            .map((entry) => (
              <div
                key={entry.id}
                className={`hub__composer-attachment${images ? " hub__composer-attachment--image" : ""}`}
                data-status={entry.status}
                title={entry.file.name}
              >
                {entry.status === "uploading" ? (
                  <span
                    className="hub__composer-attachment__status"
                    role="status"
                  >
                    <Loader size={16} aria-hidden="true" />
                    <span>
                      {images ? t("Uploading") : entry.file.name}{" "}
                      {entry.progress > 0 ? `${entry.progress}%` : ""}
                    </span>
                  </span>
                ) : entry.status === "error" ? (
                  <button
                    type="button"
                    className="hub__composer-attachment__retry"
                    onClick={() => onRetry(entry.id)}
                    disabled={disabled}
                  >
                    {t("Upload failed. Retry")}
                    <span>{entry.file.name}</span>
                  </button>
                ) : images ? (
                  <img src={entry.previewUrl} alt={entry.file.name} />
                ) : (
                  <>
                    <FileIcon
                      file={{
                        title: entry.file.name,
                        mimetype: entry.file.type,
                      }}
                      type="mini"
                      size={16}
                    />
                    <span className="hub__composer-attachment__name">
                      {entry.file.name}
                    </span>
                  </>
                )}
                <button
                  type="button"
                  className="hub__composer-attachment__remove"
                  aria-label={t("Remove {{name}}", { name: entry.file.name })}
                  disabled={disabled}
                  onClick={() => onRemove(entry.id)}
                >
                  <XMark size={16} />
                </button>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
};
