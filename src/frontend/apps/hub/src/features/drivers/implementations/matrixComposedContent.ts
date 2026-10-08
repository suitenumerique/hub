import { MsgType, RelationType } from "matrix-js-sdk/lib/matrix";
import {
  type RoomMessageEventContent,
  type RoomMessageTextEventContent,
} from "matrix-js-sdk/lib/types";

import type { ChatComposedMessage } from "../types";

type MatrixMentions = NonNullable<RoomMessageTextEventContent["m.mentions"]>;

/**
 * The `m.mentions` of a message: the users it mentions on purpose, never the
 * sender. Always sent, empty included, as Element does: it tells homeservers
 * not to guess mentions from names found in the body.
 */
export const matrixMentions = (
  userIds: readonly string[] | undefined,
  selfUserId: string | null,
): MatrixMentions => {
  const mentioned = [...new Set(userIds)].filter((id) => id !== selfUserId);
  return mentioned.length > 0 ? { user_ids: mentioned } : {};
};

const formattedBody = (htmlContent: string | undefined, prefix = "") =>
  htmlContent
    ? {
        format: "org.matrix.custom.html" as const,
        formatted_body: `${prefix}${htmlContent}`,
      }
    : {};

/** An `m.text` message: the body, its formatted version and its mentions. */
export const matrixTextContent = (
  message: ChatComposedMessage,
  selfUserId: string | null,
): RoomMessageTextEventContent => ({
  msgtype: MsgType.Text,
  body: message.content,
  ...formattedBody(message.htmlContent),
  "m.mentions": matrixMentions(message.mentionedUserIds, selfUserId),
});

/** Formatted caption and mentions to add to an attachment's content. */
export const matrixCaptionContent = (
  message: ChatComposedMessage,
  selfUserId: string | null,
) => ({
  ...(message.content ? formattedBody(message.htmlContent) : {}),
  "m.mentions": matrixMentions(message.mentionedUserIds, selfUserId),
});

/**
 * An `m.replace` edit of `targetId`, as Element builds it: the whole new
 * message in `m.new_content`, a `* ` fallback for clients without edits, and
 * at the top level only the mentions `previousContent` (the latest version)
 * did not have, so nobody is notified twice.
 */
export const matrixEditContent = (
  message: ChatComposedMessage,
  targetId: string,
  previousContent: { "m.mentions"?: { user_ids?: unknown } },
  selfUserId: string | null,
): RoomMessageEventContent => {
  const previousIds = previousContent["m.mentions"]?.user_ids;
  const known = new Set(Array.isArray(previousIds) ? previousIds : []);
  return {
    msgtype: MsgType.Text,
    body: `* ${message.content}`,
    ...formattedBody(message.htmlContent, "* "),
    "m.mentions": matrixMentions(
      message.mentionedUserIds?.filter((id) => !known.has(id)),
      selfUserId,
    ),
    "m.new_content": matrixTextContent(message, selfUserId),
    "m.relates_to": { rel_type: RelationType.Replace, event_id: targetId },
  };
};
