import { find, test } from "linkifyjs";

import { isShownAsLink } from "../formattedContent";

import { parseMarkdown } from "./markdown";

/** Whether `text` is a markdown link as a whole, such as `[Docs](https://…)`. */
const isMarkdownLink = (text: string): boolean => {
  const paragraph = parseMarkdown(text).firstChild;
  const link = paragraph?.firstChild;
  return (
    paragraph?.type === "paragraph" &&
    !paragraph.next &&
    link?.type === "link" &&
    link === paragraph.lastChild
  );
};

/**
 * Where `text` links to when it is one URL that messages show as a link.
 * As in Slack, a domain without a scheme, such as `example.com`, links over
 * HTTPS: written as is, it would make a relative link. A `file:` URL is
 * shown as text, so it makes no link.
 */
const linkTarget = (text: string): string | null => {
  if (!test(text, "url")) {
    return null;
  }
  const href = find(text, "url", { defaultProtocol: "https" })[0]?.href;
  return href && isShownAsLink(href) ? href : null;
};

/**
 * What pasting `pasted` over the `selected` text writes, as in Slack or
 * Element: a URL pasted on a selection turns it into a markdown link,
 * `[selection](url)`, with the whitespace around the selection left out of
 * it. Returns `null` for any other paste, which replaces the selection as
 * usual: a selection that is a link already, or text that is not a URL.
 */
export const linkPastedOnSelection = (
  selected: string,
  pasted: string,
): string | null => {
  const label = selected.trim();
  const url = linkTarget(pasted.trim());
  if (!label || test(label) || isMarkdownLink(label) || !url) {
    return null;
  }
  const leading = selected.slice(
    0,
    selected.length - selected.trimStart().length,
  );
  const trailing = selected.slice(selected.trimEnd().length);
  return `${leading}[${label}](${url})${trailing}`;
};
