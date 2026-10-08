import { find } from "linkifyjs";
import { createElement, Fragment, type ReactNode } from "react";

import { parseUserPermalink } from "./mentionPermalinks";

/**
 * Turns the untrusted HTML of a formatted message (Matrix
 * `org.matrix.custom.html`) into React nodes. The HTML is parsed into an inert
 * document (no script runs, no resource loads), then rebuilt element by
 * element from an allowlist mirroring Element's: no raw HTML reaches the page,
 * text goes through React's escaping and only vetted attributes are copied.
 * URLs typed in the text become links, in plain and formatted messages alike.
 */

/** Tags of the Matrix subset rendered as themselves. */
const RENDERED_TAGS = new Set([
  "del",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "p",
  "ul",
  "ol",
  "sup",
  "sub",
  "li",
  "b",
  "i",
  "u",
  "strong",
  "em",
  "code",
  "hr",
  "br",
  "div",
  "table",
  "thead",
  "caption",
  "tbody",
  "tr",
  "th",
  "td",
  "pre",
  "span",
  "details",
  "summary",
]);

/**
 * Deprecated tags of the subset, rendered with their current equivalent. A Map,
 * as tag names come from the message: `<constructor>` must not hit a prototype.
 */
const LEGACY_TAGS = new Map([
  ["font", "span"],
  ["strike", "s"],
]);

/**
 * Tags dropped with their content: the legacy reply fallback (it quotes
 * another message) and elements whose text is code rather than prose. Any
 * other unknown tag is unwrapped and keeps its text.
 */
const DROPPED_TAGS = new Set([
  "mx-reply",
  "script",
  "style",
  "template",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "noscript",
  "textarea",
  "select",
  "option",
  "xmp",
]);

/** Table containers, where the parser's whitespace is not valid React text. */
const TABLE_CONTAINERS = new Set(["table", "thead", "tbody", "tr"]);

/** Tags whose text is never turned into links, as in Element. */
const UNLINKIFIED_TAGS = new Set(["a", "pre", "code"]);

/** Element's link schemes, except `file:`; other links render as text. */
const LINK_PROTOCOLS = new Set([
  "http:",
  "https:",
  "ftp:",
  "ftps:",
  "mailto:",
  "tel:",
  "sms:",
  "smsto:",
  "geo:",
  "magnet:",
  "matrix:",
  "xmpp:",
  "sip:",
  "im:",
  "news:",
  "urn:",
  "bitcoin:",
  "openpgp4fpr:",
]);

/** Element's nesting limit; deeper markup renders as its text. */
const MAX_DEPTH = 50;

const parseUrl = (href: string): URL | null => {
  try {
    return new URL(href);
  } catch {
    return null;
  }
};

/** A link out of the Hub, opened in a new tab without leaking the page. */
const externalLink = (url: URL, children: ReactNode[]): ReactNode =>
  createElement(
    "a",
    {
      className: "hub__message-link",
      href: url.href,
      target: "_blank",
      rel: "noreferrer noopener",
    },
    ...children,
  );

/**
 * The text with the URLs it contains as links. Like Element, only full URLs
 * qualify: `example.com` or `README.md` stay text, and so do email addresses.
 */
const linkifyText = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const link of find(text, "url")) {
    const url = parseUrl(link.value);
    if (url && LINK_PROTOCOLS.has(url.protocol)) {
      nodes.push(
        text.slice(cursor, link.start),
        externalLink(url, [link.value]),
      );
      cursor = link.end;
    }
  }
  nodes.push(text.slice(cursor));
  return nodes;
};

type RenderState = { hasMarkup: boolean };

const renderChildren = (
  parent: Element,
  depth: number,
  linkify: boolean,
  state: RenderState,
): ReactNode[] =>
  Array.from(parent.childNodes, (child) =>
    renderNode(child, parent.localName, depth, linkify, state),
  );

const renderLink = (
  element: Element,
  children: ReactNode[],
  state: RenderState,
): ReactNode => {
  const url = parseUrl(element.getAttribute("href") ?? "");
  if (!url || !LINK_PROTOCOLS.has(url.protocol)) {
    return createElement(Fragment, null, ...children);
  }
  state.hasMarkup = true;
  const userId = parseUserPermalink(url.href);
  if (userId) {
    return createElement(
      "span",
      { className: "hub__message-mention", title: userId },
      ...children,
    );
  }
  return externalLink(url, children);
};

const renderNode = (
  node: Node,
  parentTag: string,
  depth: number,
  linkify: boolean,
  state: RenderState,
): ReactNode => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (TABLE_CONTAINERS.has(parentTag) && !text.trim()) {
      return null;
    }
    return linkify ? createElement(Fragment, null, ...linkifyText(text)) : text;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const element = node as Element;
  const tag = element.localName;
  if (DROPPED_TAGS.has(tag)) {
    return null;
  }
  if (depth >= MAX_DEPTH) {
    return element.textContent;
  }
  // Inline images point to media this view does not load; keep their label.
  if (tag === "img") {
    return element.getAttribute("alt") || element.getAttribute("title");
  }
  const children = renderChildren(
    element,
    depth + 1,
    linkify && !UNLINKIFIED_TAGS.has(tag),
    state,
  );
  if (tag === "a") {
    return renderLink(element, children, state);
  }
  const renderedTag =
    LEGACY_TAGS.get(tag) ?? (RENDERED_TAGS.has(tag) ? tag : null);
  if (!renderedTag) {
    return createElement(Fragment, null, ...children);
  }
  state.hasMarkup = true;
  const start = Number.parseInt(element.getAttribute("start") ?? "", 10);
  const props = tag === "ol" && Number.isInteger(start) ? { start } : null;
  return createElement(renderedTag, props, ...children);
};

/** React nodes for a plain-text message: its text, with clickable URLs. */
export const renderPlainContent = (text: string): ReactNode =>
  createElement(Fragment, null, ...linkifyText(text));

export type FormattedContent = {
  nodes: ReactNode;
  /** False for text only, which keeps the bubble's own line breaks. */
  hasMarkup: boolean;
  /** No text at all: the plain body is the better rendering. */
  isEmpty: boolean;
};

/** React nodes for a formatted message, or `null` without a DOM. */
export const renderFormattedContent = (
  html: string,
): FormattedContent | null => {
  // The static export prerenders without a DOM; messages only load client-side.
  if (typeof DOMParser === "undefined") {
    return null;
  }
  const { body } = new DOMParser().parseFromString(html, "text/html");
  const state: RenderState = { hasMarkup: false };
  const nodes = renderChildren(body, 0, true, state);
  return {
    nodes: createElement(Fragment, null, ...nodes),
    hasMarkup: state.hasMarkup,
    isEmpty: !body.textContent?.trim(),
  };
};
