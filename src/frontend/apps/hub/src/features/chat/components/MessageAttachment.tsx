import { FileIcon, IconSize } from "@gouvfr-lasuite/ui-components";
import { Loader, PictureRemove } from "@gouvfr-lasuite/ui-components/icons";
import { useIsFetching } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { AccountId, ChatAttachment } from "@/features/drivers/types";

import { useChatAttachmentPreview } from "../ChatAttachmentPreviewContext";
import { chatKeys } from "../chatKeys";
import { useChatAttachmentUrl } from "../hooks/useChatAttachmentUrl";

/**
 * Inline images fit in this box; the height follows the image ratio. Low
 * enough that a tall image does not fill the conversation, wide enough (the
 * bubble's own limit) that a landscape one stays legible.
 */
const INLINE_IMAGE_MAX_WIDTH = 500;
const INLINE_IMAGE_MAX_HEIGHT = 332;
/** Box reserved for an image whose sender did not declare its size. */
const UNKNOWN_IMAGE_SIZE = { width: 380, height: 214 };

type ImageSize = { width: number; height: number };

/** Scales an image down (never up) into the inline box, keeping its ratio. */
const fitInlineImage = (
  width: number | undefined,
  height: number | undefined,
): ImageSize | undefined => {
  if (!width || !height) {
    return undefined;
  }
  const scale = Math.min(
    1,
    INLINE_IMAGE_MAX_WIDTH / width,
    INLINE_IMAGE_MAX_HEIGHT / height,
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

/**
 * Transparent stand-in with the displayed image size, so the row keeps its
 * final height while the bytes load and the virtual list does not jump.
 */
const placeholderSource = ({ width, height }: ImageSize): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`,
  )}`;

type MessageAttachmentProps = {
  accountId: AccountId;
  messageId: string;
  attachment: ChatAttachment;
  senderName: string;
  sentAt: string;
  threadId?: string;
};

/**
 * File carried by a message: images render inline (at most 500x332), other
 * files as a card with their type icon. Both open the design-system preview,
 * owned by `ChatView` (see `ChatAttachmentPreviewContext`).
 */
export const MessageAttachment = ({
  accountId,
  messageId,
  attachment,
  senderName,
  sentAt,
  threadId,
}: MessageAttachmentProps) => {
  const { t } = useTranslation();
  const { openAttachment } = useChatAttachmentPreview();
  const [loadedSize, setLoadedSize] = useState<ImageSize>();
  const isImage = attachment.kind === "image";
  const inline = useChatAttachmentUrl(
    accountId,
    attachment,
    "preview",
    isImage,
  );
  // The original is fetched to preview or download the file: the card shows
  // that wait, whichever started it.
  const isFetchingOriginal =
    useIsFetching({
      queryKey: chatKeys.attachment(accountId, attachment, "original"),
    }) > 0;

  const openPreview = () =>
    openAttachment({
      accountId,
      messageId,
      attachment,
      senderName,
      sentAt,
      threadId,
    });
  // Sized through `width`/`height` attributes rather than a percentage
  // max-width, which shrink-to-fit bubbles ignore when measuring content.
  const imageSize =
    fitInlineImage(attachment.width, attachment.height) ??
    fitInlineImage(loadedSize?.width, loadedSize?.height) ??
    UNKNOWN_IMAGE_SIZE;

  return isImage ? (
    <button
      type="button"
      className="hub__message-attachment hub__message-attachment--image"
      aria-label={t("Open {{name}}", { name: attachment.name })}
      aria-busy={isFetchingOriginal || undefined}
      onClick={openPreview}
    >
      <img
        className="hub__message-attachment__image"
        src={inline.url ?? placeholderSource(imageSize)}
        width={imageSize.width}
        height={imageSize.height}
        alt=""
        draggable={false}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (inline.url && naturalWidth && naturalHeight) {
            setLoadedSize({ width: naturalWidth, height: naturalHeight });
          }
        }}
      />
      {(!inline.url || isFetchingOriginal) && (
        <span
          className="hub__message-attachment__status"
          data-over-image={inline.url ? true : undefined}
        >
          {inline.isError && !isFetchingOriginal ? (
            <PictureRemove size={24} aria-hidden="true" />
          ) : (
            <Loader
              className="hub__spinning-icon"
              size={24}
              aria-hidden="true"
            />
          )}
        </span>
      )}
    </button>
  ) : (
    <button
      type="button"
      className="hub__message-attachment hub__message-attachment--file"
      title={attachment.name}
      aria-busy={isFetchingOriginal || undefined}
      onClick={openPreview}
    >
      <span className="hub__message-attachment__icon">
        {isFetchingOriginal ? (
          <Loader className="hub__spinning-icon" size={24} aria-hidden="true" />
        ) : (
          <FileIcon
            file={{ mimetype: attachment.mimetype, title: attachment.name }}
            size={IconSize.LARGE}
          />
        )}
      </span>
      <span className="hub__message-attachment__name">{attachment.name}</span>
    </button>
  );
};
