import type { ChatMessage } from "@/features/drivers/types";

import type { EditingChatMessage } from "./ChatMessageEditContext";

/** As Element's `findEditableEvent`, never further than this many messages. */
const MAX_JUMP_DISTANCE = 100;

const isEditable = (message: ChatMessage) =>
  message.canEdit === true && !message.isDeleted && !message.sendFailed;

/**
 * The user's message to edit with ↑ or ↓ in the composer, among `messages`
 * from the oldest to the latest: the latest one without `fromId`, otherwise
 * the one before or after it.
 */
export const findEditableMessage = (
  messages: readonly ChatMessage[],
  fromId: string | null,
  direction: "previous" | "next",
): EditingChatMessage | null => {
  const step = direction === "previous" ? -1 : 1;
  let index = messages.length;
  if (fromId !== null) {
    index = messages.findIndex((message) => message.id === fromId);
    if (index === -1) {
      return null;
    }
  } else if (direction === "next") {
    return null;
  }
  for (let distance = 1; distance <= MAX_JUMP_DISTANCE; distance += 1) {
    const message = messages[index + step * distance];
    if (!message) {
      return null;
    }
    if (isEditable(message)) {
      return {
        id: message.id,
        content: message.content,
        htmlContent: message.htmlContent,
      };
    }
  }
  return null;
};
