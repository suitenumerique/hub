import {
  getExtensionFromName,
  getMimeCategory,
  MimeCategory,
} from "@gouvfr-lasuite/ui-components";
import type { QueryClient } from "@tanstack/react-query";

import { withSafeBlobType } from "@/features/drivers/blobs";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { AccountId, ChatAttachment } from "@/features/drivers/types";

import { chatKeys } from "./chatKeys";

export type ChatAttachmentVariant = "original" | "preview";

/**
 * Attachment bytes are immutable for a given source, so a fetched blob never
 * goes stale. Unused blobs leave memory once their last viewer unmounts.
 */
export const chatAttachmentQueryOptions = (
  accountId: AccountId,
  attachment: ChatAttachment,
  variant: ChatAttachmentVariant,
) => ({
  queryKey: chatKeys.attachment(accountId, attachment, variant),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    getRegistry()
      .get(accountId)
      .downloadChatAttachment({ attachment, variant, signal }),
  staleTime: Infinity,
  gcTime: 5 * 60_000,
  retry: 1,
  meta: { noGlobalError: true },
});

/**
 * Seeds the blob cache with a file the user just uploaded, so the sent message
 * renders from local bytes instead of downloading them back.
 */
export const primeChatAttachment = (
  queryClient: QueryClient,
  accountId: AccountId,
  attachment: ChatAttachment,
  file: Blob,
): void => {
  const blob = withSafeBlobType(file, attachment.mimetype);
  for (const variant of ["original", "preview"] as const) {
    queryClient.setQueryData(
      chatKeys.attachment(accountId, attachment, variant),
      blob,
    );
  }
};

/** Image types every browser renders, shown as thumbnails in the composer. */
const INLINE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

export const isInlineImageType = (mimetype: string): boolean =>
  INLINE_IMAGE_TYPES.has(mimetype.toLowerCase());

/**
 * SVG can embed scripts, so its bytes never keep their type in a blob (see
 * `drivers/blobs`) and the browser cannot render it: download only.
 */
export const isSvgAttachment = ({ mimetype }: ChatAttachment): boolean =>
  mimetype.toLowerCase().startsWith("image/svg");

/** Categories the design-system file preview can render in place. */
export const isPreviewableAttachment = (
  attachment: ChatAttachment,
): boolean => {
  const { mimetype, name } = attachment;
  const category = getMimeCategory(mimetype, getExtensionFromName(name));
  if (category === MimeCategory.IMAGE) {
    // The preview only knows how to explain HEIC, not render it.
    return !mimetype.includes("heic") && !isSvgAttachment(attachment);
  }
  return (
    category === MimeCategory.PDF ||
    category === MimeCategory.VIDEO ||
    category === MimeCategory.AUDIO
  );
};

/** Hands a blob to the browser as a file download. */
export const saveBlob = (blob: Blob, name: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

/** Localized size such as "50 MB", used to explain the upload limit. */
export const formatFileSize = (bytes: number, locale?: string): string => {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: units[unitIndex],
    unitDisplay: "short",
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(value);
};
