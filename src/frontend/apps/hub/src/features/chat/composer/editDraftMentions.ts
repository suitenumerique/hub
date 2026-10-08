import { parseUserPermalink } from "../mentionPermalinks";

import { type ComposerMention, validateMentions } from "./composerDraft";

const countOccurrences = (text: string, name: string): number => {
  let count = 0;
  for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + 1)) {
    count += 1;
  }
  return count;
};

const nthIndexOf = (text: string, name: string, n: number): number => {
  let at = text.indexOf(name);
  for (let index = 0; index < n && at >= 0; index += 1) {
    at = text.indexOf(name, at + 1);
  }
  return at;
};

/**
 * The mentions of a message being edited, found back in its body: Element and
 * the Hub write the body as typed, each mention as its name, while the
 * formatted body links that name to the person. The n-th link reading "Alice"
 * marks the n-th "Alice" of the body; a name the body lacks stays plain text.
 */
export const mentionsFromFormattedBody = (
  body: string,
  html: string | undefined,
): ComposerMention[] => {
  if (!html || typeof DOMParser === "undefined") {
    return [];
  }
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const mentions: ComposerMention[] = [];
  let lastEnd = 0;
  for (const anchor of parsed.body.querySelectorAll("a[href]")) {
    const userId = parseUserPermalink(anchor.getAttribute("href") ?? "");
    const name = anchor.textContent ?? "";
    if (!userId || !name) {
      continue;
    }
    const before = parsed.createRange();
    before.setStart(parsed.body, 0);
    before.setEndBefore(anchor);
    let start = nthIndexOf(
      body,
      name,
      countOccurrences(before.toString(), name),
    );
    if (start < lastEnd) {
      start = body.indexOf(name, lastEnd);
    }
    if (start >= 0) {
      mentions.push({ start, end: start + name.length, userId, name });
      lastEnd = start + name.length;
    }
  }
  return validateMentions(mentions, body);
};
