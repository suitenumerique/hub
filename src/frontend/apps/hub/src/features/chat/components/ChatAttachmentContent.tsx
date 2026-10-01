import { FileIcon } from "@gouvfr-lasuite/ui-components";
import { Loader } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { ChatAttachment, ChatRef } from "@/features/drivers/types";
import { useChatAttachmentActions } from "../ChatAttachmentContext";
import { useChatAttachmentMedia } from "../hooks/useChatAttachmentMedia";

export const ChatAttachmentContent = ({
  chatRef,
  attachment,
}: {
  chatRef: ChatRef;
  attachment: ChatAttachment;
}) => {
  const { t } = useTranslation();
  const isImage = attachment.mimetype.startsWith("image/");
  const media = useChatAttachmentMedia(chatRef, attachment, isImage);
  const [failedUrl, setFailedUrl] = useState<string>();
  const { openFile } = useChatAttachmentActions();
  return (
    <button
      type="button"
      className={`hub__chat-attachment${isImage ? " hub__chat-attachment--image" : ""}`}
      aria-label={t("Preview {{name}}", { name: attachment.name })}
      onClick={() => openFile(chatRef, attachment)}
    >
      {isImage && media.url && failedUrl !== media.url ? (
        <img
          src={media.url}
          alt={attachment.name}
          width={attachment.width}
          height={attachment.height}
          onError={() => setFailedUrl(media.url)}
        />
      ) : (
        <>
          {isImage && media.isFetching ? (
            <Loader size={24} aria-hidden="true" />
          ) : (
            <FileIcon
              file={{ title: attachment.name, mimetype: attachment.mimetype }}
              size={isImage ? 32 : 24}
            />
          )}
          <span>{attachment.name}</span>
        </>
      )}
    </button>
  );
};
