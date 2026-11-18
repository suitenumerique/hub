import { find, test } from "linkifyjs";

/** Whether `text` is one URL that names its scheme, such as `https://…`. */
const isUrl = (text: string): boolean =>
  // linkify adds a scheme to the href of `example.com` or `main.py`.
  test(text, "url") && find(text, "url")[0]?.href === text;

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
  const url = pasted.trim();
  if (!label || test(label) || !isUrl(url)) {
    return null;
  }
  const leading = selected.slice(
    0,
    selected.length - selected.trimStart().length,
  );
  const trailing = selected.slice(selected.trimEnd().length);
  return `${leading}[${label}](${url})${trailing}`;
};
