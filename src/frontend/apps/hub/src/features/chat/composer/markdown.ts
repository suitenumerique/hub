import { HtmlRenderer, type Node, Parser } from "commonmark";

import "./commonmarkTypes";

/**
 * Markdown as Element sends it (`Markdown.ts` in element-web): CommonMark,
 * with a single line kept inline instead of in a paragraph, newlines kept as
 * line breaks, and raw HTML escaped except a few harmless tags.
 */

/** Raw HTML tags a message may carry through. */
const ALLOWED_HTML_TAGS = ["sub", "sup", "del", "s", "u", "br", "br/"];

/** Node types that are text, whatever the markdown around them. */
const TEXT_NODES = ["text", "softbreak", "linebreak", "paragraph", "document"];

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

const isAllowedHtmlTag = (node: Node): boolean => {
  const tag = node.literal ? /^<\/?(.*)>$/.exec(node.literal)?.[1] : undefined;
  return tag !== undefined && ALLOWED_HTML_TAGS.includes(tag);
};

/** Whether the document holds more than one block (line or paragraph). */
const isMultiLine = (node: Node): boolean => {
  let root = node;
  while (root.parent) {
    root = root.parent;
  }
  return root.firstChild !== root.lastChild;
};

const isLoneEmptyItem = (node: Node): boolean =>
  !node.prev && !node.next && !node.firstChild;

export const parseMarkdown = (input: string): Node => new Parser().parse(input);

/** Whether the markdown uses no formatting at all, so it can go as plain text. */
export const isPlainMarkdown = (parsed: Node): boolean => {
  const walker = parsed.walker();
  let step;
  while ((step = walker.next())) {
    const { node } = step;
    if (TEXT_NODES.includes(node.type)) {
      continue;
    }
    if (node.type === "list" || node.type === "item") {
      // `+`, `-` or `2021.` alone parse as a list of one empty item: text.
      const item = node.type === "list" ? node.firstChild : node;
      if (item && isLoneEmptyItem(item)) {
        continue;
      }
      return false;
    }
    if (node.type === "html_inline" || node.type === "html_block") {
      // A disallowed tag is escaped into text; an allowed one needs HTML.
      if (isAllowedHtmlTag(node)) {
        return false;
      }
      continue;
    }
    return false;
  }
  return true;
};

/** The message HTML, for the `org.matrix.custom.html` formatted body. */
export const markdownToHtml = (parsed: Node): string => {
  const renderer = new HtmlRenderer({ safe: false, softbreak: "<br />" });
  const paragraph = renderer.paragraph;
  // A single line stays inline; several blocks, or a quote, keep their <p>.
  renderer.paragraph = function (node, entering) {
    if (node.parent?.type === "block_quote" || isMultiLine(node)) {
      paragraph.call(this, node, entering);
    }
  };
  renderer.link = function (node, entering) {
    if (entering && node.destination) {
      const attrs = this.attrs(node);
      attrs.push(["href", this.esc(node.destination)]);
      if (node.title) {
        attrs.push(["title", this.esc(node.title)]);
      }
      this.tag("a", attrs);
    } else {
      this.tag("/a");
    }
  };
  renderer.html_inline = function (node) {
    if (node.literal) {
      this.lit(
        isAllowedHtmlTag(node) ? node.literal : escapeHtml(node.literal),
      );
    }
  };
  renderer.html_block = function (node) {
    renderer.html_inline.call(this, node);
  };
  return renderer.render(parsed);
};

/**
 * Plain markdown as text without its escaping backslashes (`\*` → `*`), HTML
 * escaped: only meant for markdown `isPlainMarkdown` accepts.
 */
export const markdownToPlainText = (parsed: Node): string => {
  const renderer = new HtmlRenderer({ safe: false });
  renderer.paragraph = function (node, entering) {
    if (isMultiLine(node) && !entering && node.next) {
      this.lit("\n\n");
    }
  };
  renderer.html_block = function (node) {
    if (node.literal) {
      this.lit(node.literal);
    }
    if (isMultiLine(node) && node.next) {
      this.lit("\n\n");
    }
  };
  // The whole output is escaped below, so backslashes are handled once.
  renderer.esc = (text) => text;
  return escapeHtml(renderer.render(parsed));
};
