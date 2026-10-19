import { HtmlRenderer, type Node, Parser } from "commonmark";
import { find } from "linkifyjs";

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

/** Emphasis delimiters a bare URL may hold, such as `__init__.py`. */
const URL_EMPHASIS = /[*_]/;
/** Delimiters linkify keeps at the end of a URL: they close what precedes. */
const TRAILING_DELIMITERS = /(?:\\?[*_`])+$/;
const PLACEHOLDER = /(\d+)/g;
const PLACEHOLDER_CHARS = /[]/;
const ENCODED_PLACEHOLDER = /%EE%80%8[01]/i;
/** CommonMark backslash escapes, which text reads but code keeps. */
const BACKSLASH_ESCAPE = /\\([!-/:-@[-`{-~])/g;

/** Whether a URL starting at `start` is a link destination markdown parses. */
const isMarkdownLinkTarget = (input: string, start: number): boolean => {
  const before = input.slice(0, start);
  const line = before.slice(before.lastIndexOf("\n") + 1);
  return (
    /\]\(\s*$/.test(before) ||
    before.endsWith("<") ||
    /^ {0,3}\[[^\]]+\]:\s*$/.test(line)
  );
};

/**
 * Swaps each bare URL holding `_` or `*` for a placeholder markdown leaves
 * alone. CommonMark does not recognize bare URLs, so it would read
 * `https://host/__init__.py` as emphasis and break the link for every
 * recipient (element-web#4674).
 */
const protectUrls = (input: string): { text: string; urls: string[] } => {
  const urls: string[] = [];
  let text = "";
  let last = 0;
  for (const link of find(input, "url")) {
    // In `[https://…](https://…)`, linkify reads on into the destination.
    const label = link.value.split("](")[0];
    const url = label.replace(TRAILING_DELIMITERS, "");
    if (!URL_EMPHASIS.test(url) || isMarkdownLinkTarget(input, link.start)) {
      continue;
    }
    text += `${input.slice(last, link.start)}${urls.length}`;
    urls.push(url);
    last = link.start + url.length;
  }
  return { text: text + input.slice(last), urls };
};

/**
 * Puts the protected URLs back as typed. Returns `false` when one ended up
 * in a link destination, where markdown has already encoded it.
 */
const restoreUrls = (parsed: Node, urls: readonly string[]): boolean => {
  const walker = parsed.walker();
  let step;
  while ((step = walker.next())) {
    const { node } = step;
    if (
      [node.destination, node.title].some(
        (value) =>
          value &&
          (PLACEHOLDER_CHARS.test(value) || ENCODED_PLACEHOLDER.test(value)),
      )
    ) {
      return false;
    }
    if (step.entering && node.literal && PLACEHOLDER_CHARS.test(node.literal)) {
      const isText = node.type === "text";
      node.literal = node.literal.replace(
        PLACEHOLDER,
        (_match, index: string) => {
          const url = urls[Number(index)] ?? "";
          return isText ? url.replace(BACKSLASH_ESCAPE, "$1") : url;
        },
      );
    }
  }
  return true;
};

export const parseMarkdown = (input: string): Node => {
  if (PLACEHOLDER_CHARS.test(input)) {
    return new Parser().parse(input);
  }
  const { text, urls } = protectUrls(input);
  if (urls.length === 0) {
    return new Parser().parse(input);
  }
  const parsed = new Parser().parse(text);
  return restoreUrls(parsed, urls) ? parsed : new Parser().parse(input);
};

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
