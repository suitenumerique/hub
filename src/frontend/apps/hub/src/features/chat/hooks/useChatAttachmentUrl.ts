import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { AccountId, ChatAttachment } from "@/features/drivers/types";

import {
  type ChatAttachmentVariant,
  chatAttachmentQueryOptions,
} from "../attachments";

/** Object URL for a blob, revoked when the blob changes or on unmount. */
export const useObjectUrl = (blob: Blob | undefined): string | undefined => {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
};

export type UseChatAttachmentUrlResult = {
  url: string | undefined;
  isError: boolean;
};

/**
 * Downloads an attachment through its driver and exposes it as an object URL.
 * Media served by Matrix needs an `Authorization` header, so a plain
 * `<img src>` pointing at the homeserver cannot be used.
 */
export const useChatAttachmentUrl = (
  accountId: AccountId,
  attachment: ChatAttachment,
  variant: ChatAttachmentVariant,
  enabled = true,
): UseChatAttachmentUrlResult => {
  const { data, isError } = useQuery({
    ...chatAttachmentQueryOptions(accountId, attachment, variant),
    enabled,
  });
  return { url: useObjectUrl(data), isError };
};
