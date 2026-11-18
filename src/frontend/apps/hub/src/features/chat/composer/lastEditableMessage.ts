import type { ChatMessage } from "@/features/drivers/types";

import type { EditingChatMessage } from "../ChatMessageEditContext";

/**
 * Message the up arrow of an empty composer opens for editing, among
 * `messages` from oldest to newest. As Element's `findEditableEvent`, the
 * last one of this user that can be edited: files and messages still being
 * sent, or that could not be sent, are passed over.
 */
export const lastEditableMessage = (
  messages: readonly ChatMessage[],
): EditingChatMessage | null => {
  const message = messages.findLast(
    ({ canEdit, isDeleted, sendFailed }) =>
      canEdit === true && !isDeleted && !sendFailed,
  );
  return message
    ? {
        id: message.id,
        content: message.content,
        htmlContent: message.htmlContent,
      }
    : null;
};
