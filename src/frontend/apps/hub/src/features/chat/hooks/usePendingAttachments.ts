import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChatAttachmentTooLargeError } from "@/features/drivers/Driver";
import type { ChatAttachment } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { formatFileSize, isInlineImageType } from "../attachments";

import type { UploadChatAttachment } from "./useChatAttachmentActions";

/** A file added to the composer, uploaded as soon as it is picked. */
export type PendingAttachment = {
  id: string;
  file: File;
  /** Shown as a thumbnail rather than a file chip. */
  isImage: boolean;
} & (
  | {
      status: "uploading";
      /** Uploaded fraction, from 0 to 1. */
      progress: number;
    }
  | { status: "failed" }
  | {
      status: "ready";
      /** The stored file, ready to be posted. */
      attachment: ChatAttachment;
      /** Local object URL of an image thumbnail. */
      previewUrl?: string;
    }
);

let pendingAttachmentId = 0;

export type UsePendingAttachmentsResult = {
  items: PendingAttachment[];
  addFiles: (files: Iterable<File>) => void;
  /** Drops one file, cancelling its upload when still in flight. */
  remove: (id: string) => void;
  /** Uploads a failed file again. */
  retry: (id: string) => void;
  /** Drops every file, e.g. when the composer switches conversation. */
  clear: () => void;
};

/**
 * Composer-side queue of attachments. Each file uploads in the background so
 * sending only has to post the already stored files.
 */
export const usePendingAttachments = (
  upload: UploadChatAttachment | undefined,
): UsePendingAttachmentsResult => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const previewUrls = useRef(new Map<string, string>());

  const dispose = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    const previewUrl = previewUrls.current.get(id);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrls.current.delete(id);
    }
  }, []);

  const remove = useCallback(
    (id: string) => {
      dispose(id);
      setItems((current) => current.filter((item) => item.id !== id));
    },
    [dispose],
  );

  const clear = useCallback(() => {
    [...controllers.current.keys(), ...previewUrls.current.keys()].forEach(
      dispose,
    );
    setItems((current) => (current.length > 0 ? [] : current));
  }, [dispose]);

  // Abort uploads and release thumbnails when the composer unmounts.
  useEffect(() => {
    const pendingControllers = controllers.current;
    const pendingPreviewUrls = previewUrls.current;
    return () => {
      pendingControllers.forEach((controller) => controller.abort());
      pendingPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const reportTooLarge = useCallback(
    (file: File, maxSize: number) => {
      notify.error(
        t("{{name}} is too large. Files must not exceed {{size}}.", {
          name: file.name,
          size: formatFileSize(maxSize, i18n.resolvedLanguage ?? i18n.language),
        }),
      );
    },
    [i18n.language, i18n.resolvedLanguage, t],
  );

  /** Uploads one queued file, keeping its row in sync with the transfer. */
  const startUpload = useCallback(
    ({
      id,
      file,
      isImage,
    }: Pick<PendingAttachment, "id" | "file" | "isImage">) => {
      if (!upload) {
        return;
      }
      const controller = new AbortController();
      controllers.current.set(id, controller);
      const replace = (next: PendingAttachment) =>
        setItems((current) =>
          current.map((item) => (item.id === id ? next : item)),
        );
      const base = { id, file, isImage };
      let shownPercent = 0;

      upload(file, {
        signal: controller.signal,
        onProgress: (progress) => {
          // Re-render once per percent, not once per network chunk.
          const percent = Math.floor(progress * 100);
          if (!controller.signal.aborted && percent > shownPercent) {
            shownPercent = percent;
            replace({ ...base, status: "uploading", progress });
          }
        },
      }).then(
        (attachment) => {
          if (controller.signal.aborted) {
            return;
          }
          controllers.current.delete(id);
          const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
          if (previewUrl) {
            previewUrls.current.set(id, previewUrl);
          }
          replace({ ...base, status: "ready", attachment, previewUrl });
        },
        (error: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          controllers.current.delete(id);
          // Retrying cannot help a file above the server limit.
          if (error instanceof ChatAttachmentTooLargeError) {
            remove(id);
            reportTooLarge(file, error.maxSize);
            return;
          }
          replace({ ...base, status: "failed" });
        },
      );
    },
    [remove, reportTooLarge, upload],
  );

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      if (!upload) {
        return;
      }
      for (const file of files) {
        pendingAttachmentId += 1;
        const item = {
          id: `pending-attachment-${pendingAttachmentId}`,
          file,
          isImage: isInlineImageType(file.type),
        };
        setItems((current) => [
          ...current,
          { ...item, status: "uploading", progress: 0 },
        ]);
        startUpload(item);
      }
    },
    [startUpload, upload],
  );

  const retry = useCallback(
    (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item || item.status !== "failed") {
        return;
      }
      setItems((current) =>
        current.map(
          (candidate): PendingAttachment =>
            candidate.id === id
              ? { ...item, status: "uploading", progress: 0 }
              : candidate,
        ),
      );
      startUpload(item);
    },
    [items, startUpload],
  );

  return { items, addFiles, remove, retry, clear };
};
