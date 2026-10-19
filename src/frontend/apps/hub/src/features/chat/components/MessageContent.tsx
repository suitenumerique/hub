import { useMemo } from "react";

import {
  renderFormattedContent,
  renderPlainContent,
} from "../formattedContent";

type MessageContentProps = {
  content: string;
  htmlContent?: string;
};

/**
 * The text of a message: its formatted body when it has one, as Element shows
 * it, else its plain text (newlines kept by the bubble), with clickable URLs
 * either way.
 */
export const MessageContent = ({
  content,
  htmlContent,
}: MessageContentProps) => {
  const formatted = useMemo(
    () => (htmlContent ? renderFormattedContent(htmlContent) : null),
    [htmlContent],
  );
  const usesFormatted = formatted !== null && !formatted.isEmpty;
  const plain = useMemo(
    () => (usesFormatted ? null : renderPlainContent(content)),
    [content, usesFormatted],
  );
  if (!usesFormatted) {
    return plain;
  }
  // Text-only formatted bodies (`\*x\*` sent as `*x*`) keep the line breaks.
  return formatted.hasMarkup ? (
    <div className="hub__message-content">{formatted.nodes}</div>
  ) : (
    formatted.nodes
  );
};
