import { createContext, useContext } from "react";

import type { AccountId, ChatAttachment } from "@/features/drivers/types";

export type PreviewedAttachment = {
  accountId: AccountId;
  messageId: string;
  attachment: ChatAttachment;
  /** Display name of whoever posted the file, shown in its details. */
  senderName: string;
  /** ISO timestamp of the message carrying the file. */
  sentAt: string;
  /** Thread the message belongs to, where its deletion shows up. */
  threadId?: string;
};

/**
 * Lets message bubbles open the file preview without owning it. `ChatView`
 * renders the single preview: a bubble lives in a virtualized row, which can
 * unmount (scrolling, or an optimistic id replaced by the server one) while
 * its file is still open.
 */
export type ChatAttachmentPreviewContextValue = {
  openAttachment: (target: PreviewedAttachment) => void;
};

const ChatAttachmentPreviewContext =
  createContext<ChatAttachmentPreviewContextValue>({
    openAttachment: () => {},
  });

export const ChatAttachmentPreviewProvider =
  ChatAttachmentPreviewContext.Provider;

export const useChatAttachmentPreview = (): ChatAttachmentPreviewContextValue =>
  useContext(ChatAttachmentPreviewContext);
