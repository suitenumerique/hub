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
 * The text of a message: its formatting when it has some, its plain text
 * otherwise (newlines kept by the bubble), with clickable URLs either way.
 */
export const MessageContent = ({
  content,
  htmlContent,
}: MessageContentProps) => {
  const formatted = useMemo(
    () => (htmlContent ? renderFormattedContent(htmlContent) : null),
    [htmlContent],
  );
  const plain = useMemo(
    () => (formatted ? null : renderPlainContent(content)),
    [content, formatted],
  );
  if (!formatted) {
    return plain;
  }
  return <div className="hub__message-content">{formatted}</div>;
};
