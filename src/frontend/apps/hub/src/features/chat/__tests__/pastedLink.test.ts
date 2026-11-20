import { describe, expect, it } from "vitest";

import { markdownToHtml, parseMarkdown } from "../composer/markdown";
import { linkPastedOnSelection } from "../composer/pastedLink";

const url = "https://example.com/doc";

/** The HTML a message holding `markdown` is sent with. */
const sentHtml = (markdown: string | null): string =>
  markdownToHtml(parseMarkdown(markdown ?? ""));

describe("linkPastedOnSelection", () => {
  it("escapes a lone closing bracket of the selection", () => {
    const link = linkPastedOnSelection("step 2]", url);

    expect(link).toBe(`[step 2\\]](${url})`);
    expect(sentHtml(link)).toBe(`<a href="${url}">step 2]</a>`);
  });

  it("escapes a lone opening bracket of the selection", () => {
    const link = linkPastedOnSelection("[step 2", url);

    expect(link).toBe(`[\\[step 2](${url})`);
    expect(sentHtml(link)).toBe(`<a href="${url}">[step 2</a>`);
  });

  it("escapes the backslashes of the selection", () => {
    const link = linkPastedOnSelection("C:\\temp\\", url);

    expect(link).toBe(`[C:\\\\temp\\\\](${url})`);
    expect(sentHtml(link)).toBe(`<a href="${url}">C:\\temp\\</a>`);
  });

  it("keeps the brackets of a code span as they are", () => {
    const link = linkPastedOnSelection("see `arr[0]` here]", url);

    expect(link).toBe(`[see \`arr[0]\` here\\]](${url})`);
    expect(sentHtml(link)).toBe(
      `<a href="${url}">see <code>arr[0]</code> here]</a>`,
    );
  });

  it("escapes after a backtick never closed", () => {
    const link = linkPastedOnSelection("a `b]", url);

    expect(link).toBe(`[a \`b\\]](${url})`);
    expect(sentHtml(link)).toBe(`<a href="${url}">a \`b]</a>`);
  });
});
