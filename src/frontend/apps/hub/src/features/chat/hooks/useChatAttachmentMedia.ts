import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatAttachment, ChatRef } from "@/features/drivers/types";

export const useChatAttachmentMedia = (
  ref: ChatRef,
  attachment: ChatAttachment,
  enabled: boolean,
) => {
  const query = useQuery({
    queryKey: [
      "chat-attachment",
      ref.accountId,
      attachment.url,
      attachment.encryptedFile?.hashes.sha256,
    ],
    queryFn: ({ signal }) =>
      getRegistry().get(ref.accountId).getChatAttachment(attachment, signal),
    enabled,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
    meta: { noGlobalError: true },
  });
  const [media, setMedia] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!query.data) return;
    const url = URL.createObjectURL(query.data);
    setMedia({ blob: query.data, url });
    return () => URL.revokeObjectURL(url);
  }, [query.data]);
  return { ...query, url: media?.blob === query.data ? media?.url : undefined };
};

export const saveAttachment = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Allow browsers to consume the Blob before releasing the download URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
