import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { AccountId, ChatAttachment } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import {
  chatAttachmentQueryOptions,
  primeChatAttachment,
  saveBlob,
} from "../attachments";

import { useAccountChatAttachmentSupport } from "./useChatCompositionSupport";

/** Saves the original file of an attachment, reusing already fetched bytes. */
export const useDownloadChatAttachment = (accountId: AccountId) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useCallback(
    async (attachment: ChatAttachment) => {
      try {
        const blob = await queryClient.fetchQuery(
          chatAttachmentQueryOptions(accountId, attachment, "original"),
        );
        saveBlob(blob, attachment.name);
      } catch {
        notify.error(t("The file could not be downloaded. Please try again."));
      }
    },
    [accountId, queryClient, t],
  );
};

export type UploadChatAttachment = (
  file: File,
  options: { signal: AbortSignal; onProgress: (fraction: number) => void },
) => Promise<ChatAttachment>;

/** Where composer files go: a conversation, or an account's New Chat draft. */
export type ChatAttachmentTarget = { accountId: AccountId; chatId?: string };

/**
 * Uploads a composer file to the conversation's backend. The local bytes are
 * cached for the resulting attachment so the sent message renders instantly.
 */
export const useUploadChatAttachment = (
  target: ChatAttachmentTarget | null,
): UploadChatAttachment | undefined => {
  const queryClient = useQueryClient();
  const accountId = target?.accountId ?? null;
  const chatId = target?.chatId;
  const isSupported = useAccountChatAttachmentSupport(accountId);

  const upload = useCallback<UploadChatAttachment>(
    async (file, { signal, onProgress }) => {
      if (!accountId) {
        throw new Error("Attachments require a chat account.");
      }
      const attachment = await getRegistry()
        .get(accountId)
        .uploadChatAttachment({ chatId, file, signal, onProgress });
      primeChatAttachment(queryClient, accountId, attachment, file);
      return attachment;
    },
    [accountId, chatId, queryClient],
  );

  return isSupported ? upload : undefined;
};
