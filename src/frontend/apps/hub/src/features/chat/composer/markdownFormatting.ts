/**
 * Markdown formatting of the composer's selection, after Element's
 * `editor/operations.ts`: Ctrl/⌘ + B, I, E, > and Shift + L wrap the selection
 * in its markers, or remove them when it already has them. Without a
 * selection, the word at the caret is formatted.
 */

export type Formatting = "bold" | "italic" | "code" | "quote" | "link";

/** `start`–`end` of the text replaced by `text`. */
export type TextEdit = { start: number; end: number; text: string };

export type FormattingResult = {
  /** Sorted and apart from each other: each one is applied on its own. */
  edits: TextEdit[];
  /** Selection once the edits are applied. */
  selection: { start: number; end: number };
};

const isSpace = (character: string | undefined) =>
  character !== undefined && /\s/.test(character);

const startsLine = (text: string, at: number) =>
  at === 0 || text[at - 1] === "\n";

const endsLine = (text: string, at: number) =>
  at === text.length || text[at] === "\n";

const insert = (at: number, text: string): TextEdit => ({
  start: at,
  end: at,
  text,
});

const remove = (start: number, end: number): TextEdit => ({
  start,
  end,
  text: "",
});

const lengthChange = (edits: readonly TextEdit[]) =>
  edits.reduce(
    (total, edit) => total + edit.text.length - (edit.end - edit.start),
    0,
  );

const longestBacktickRun = (text: string) =>
  Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));

/**
 * Wraps each paragraph of `start`–`end` in `prefix` and `suffix`, or unwraps
 * it when it already starts and ends with them.
 */
const toggleInline = (
  text: string,
  start: number,
  end: number,
  prefix: string,
  suffix = prefix,
): { edits: TextEdit[]; unwrapped: boolean } => {
  const edits: TextEdit[] = [];
  let unwrapped = false;
  const paragraphs = /[^\n]+(?:\n[ \t]*[^\s][^\n]*)*/g;
  const selected = text.slice(start, end);
  for (const match of selected.matchAll(paragraphs)) {
    const leading = match[0].length - match[0].trimStart().length;
    const body = match[0].trim();
    if (!body) {
      continue;
    }
    const from = start + (match.index ?? 0) + leading;
    const to = from + body.length;
    if (
      body.length >= prefix.length + suffix.length &&
      body.startsWith(prefix) &&
      body.endsWith(suffix)
    ) {
      unwrapped = true;
      edits.push(remove(from, from + prefix.length));
      edits.push(remove(to - suffix.length, to));
    } else {
      edits.push(insert(from, prefix), insert(to, suffix));
    }
  }
  return { edits, unwrapped };
};

/** Several lines become a fenced block, one line inline code. */
const formatCodeBlock = (
  text: string,
  start: number,
  end: number,
): TextEdit[] => {
  const selected = text.slice(start, end);
  if (selected.startsWith("```") && selected.endsWith("```")) {
    const openEnd = start + 3 + (selected[3] === "\n" ? 1 : 0);
    const closeStart =
      end - 3 - (selected[selected.length - 4] === "\n" ? 1 : 0);
    return [remove(start, openEnd), remove(closeStart, end)];
  }
  return [
    insert(start, `${startsLine(text, start) ? "" : "\n"}\`\`\`\n`),
    insert(end, `\n\`\`\`${endsLine(text, end) ? "" : "\n"}`),
  ];
};

/** Inline code fenced by more backticks than the text holds. */
const codeFence = (selected: string) => {
  const run = longestBacktickRun(selected);
  const isCode = selected.startsWith("`") && selected.endsWith("`");
  return "`".repeat(isCode ? run : run + 1);
};

const formatQuote = (text: string, start: number, end: number): TextEdit[] => {
  const edits = [insert(start, `${startsLine(text, start) ? "" : "\n"}> `)];
  for (let at = start; at < end; at += 1) {
    if (text[at] === "\n") {
      edits.push(insert(at + 1, "> "));
    }
  }
  // A blank line ends the quote: what is typed after it is not quoted.
  edits.push(insert(end, endsLine(text, end) ? "\n" : "\n\n"));
  return edits;
};

/**
 * The edits formatting `selectionStart`–`selectionEnd` of `text`, or `null`
 * when there is nothing to format (only spaces, or no word at the caret).
 */
export const formatSelection = (
  text: string,
  selectionStart: number,
  selectionEnd: number,
  formatting: Formatting,
): FormattingResult | null => {
  let start = selectionStart;
  let end = selectionEnd;
  const wasEmpty = start === end;
  if (wasEmpty) {
    // As in Element, the word at the caret.
    while (start > 0 && !isSpace(text[start - 1])) start -= 1;
    while (end < text.length && !isSpace(text[end])) end += 1;
  } else {
    while (start < end && isSpace(text[start])) start += 1;
    while (end > start && isSpace(text[end - 1])) end -= 1;
  }
  if (start === end) {
    return null;
  }

  if (formatting === "link") {
    const selected = text.slice(start, end);
    const links = /\[(.*?)]\(.*?\)/g;
    if (links.test(selected)) {
      const unlinked = selected.replace(links, "$1");
      const caret = start + unlinked.length;
      return {
        edits: [{ start, end, text: unlinked }],
        selection: { start: caret, end: caret },
      };
    }
    // The caret waits between the parentheses for the address.
    const caret = end + "[](".length;
    return {
      edits: [insert(start, "["), insert(end, "]()")],
      selection: { start: caret, end: caret },
    };
  }

  let edits: TextEdit[];
  let caretShift: number | null = null;
  const selected = text.slice(start, end);
  if (formatting === "quote") {
    edits = formatQuote(text, start, end);
  } else if (formatting === "code" && selected.includes("\n")) {
    edits = formatCodeBlock(text, start, end);
  } else {
    const markers = { bold: "**", italic: "*", code: codeFence(selected) };
    const marker = markers[formatting];
    const toggled = toggleInline(text, start, end, marker);
    edits = toggled.edits;
    caretShift = toggled.unwrapped ? -marker.length : marker.length;
  }
  const newEnd = end + lengthChange(edits);
  // A formatted word keeps the caret where it was in it; a selection grows to
  // take in its markers, so that the same shortcut removes them.
  if (wasEmpty && caretShift !== null) {
    const caret = Math.min(
      Math.max(selectionStart + caretShift, start),
      newEnd,
    );
    return { edits, selection: { start: caret, end: caret } };
  }
  return { edits, selection: { start, end: newEnd } };
};
