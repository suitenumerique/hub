import type { ChatComposedMessage } from "@/features/drivers/types";

import { userPermalink } from "../mentionPermalinks";
import { type ComposerDraft, draftSegments } from "./composerDraft";
import {
  isPlainMarkdown,
  markdownToHtml,
  markdownToPlainText,
  parseMarkdown,
} from "./markdown";

/**
 * Escapes what markdown would read in a name, so a mention's link text is the
 * name itself: Element escapes the brackets, the rest guards edits, which find
 * mentions back by their text.
 */
const escapeLinkText = (name: string): string =>
  name.replace(/[\\[\]*_`<&]/g, (char) => `\\${char}`);

/**
 * The draft as Element sends it (`createMessageContent`): the text as typed
 * for the body, and markdown turned into HTML, each mention a `matrix.to` link,
 * for the formatted body when it formats anything.
 */
export const serializeComposerDraft = (
  draft: ComposerDraft,
): ChatComposedMessage => {
  const markdown = draftSegments(draft)
    .map(({ text, mention }) =>
      mention
        ? `[${escapeLinkText(mention.name)}](${userPermalink(mention.userId)})`
        : text,
    )
    .join("");
  const parsed = parseMarkdown(markdown);
  let htmlContent: string | undefined;
  if (!isPlainMarkdown(parsed)) {
    // Normalized through the browser parser, as Element does.
    htmlContent = new DOMParser().parseFromString(
      markdownToHtml(parsed),
      "text/html",
    ).body.innerHTML;
  } else if (markdown.includes("\\")) {
    // Plain text whose escaping backslashes must not show.
    htmlContent = markdownToPlainText(parsed);
  }
  const mentionedUserIds = [
    ...new Set(draft.mentions.map((mention) => mention.userId)),
  ];
  return {
    content: draft.text,
    ...(htmlContent ? { htmlContent } : {}),
    ...(mentionedUserIds.length > 0 ? { mentionedUserIds } : {}),
  };
};
