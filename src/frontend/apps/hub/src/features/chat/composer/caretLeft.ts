/** What decides where the text of a textarea wraps and each character lands. */
const MIRRORED_PROPERTIES = [
  "boxSizing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "fontVariant",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "textIndent",
  "wordSpacing",
  "tabSize",
  "whiteSpace",
  "overflowWrap",
  "wordBreak",
] as const;

/**
 * How far from the left edge of `input` character `index` is drawn. A
 * hidden copy of the text lays it out with the same metrics, the only way to
 * measure inside a textarea; the word starting there is copied too, so a
 * word pushed to the next line is measured there.
 */
export const caretLeft = (
  input: HTMLTextAreaElement,
  index: number,
): number => {
  const style = getComputedStyle(input);
  const mirror = document.createElement("div");
  for (const property of MIRRORED_PROPERTIES) {
    mirror.style[property] = style[property];
  }
  // The text wraps at the inner width, a scrollbar left out.
  mirror.style.boxSizing = "border-box";
  mirror.style.width = `${input.clientWidth}px`;
  mirror.style.position = "absolute";
  mirror.style.top = "0";
  mirror.style.left = "0";
  mirror.style.visibility = "hidden";
  mirror.style.overflow = "hidden";
  mirror.textContent = input.value.slice(0, index);
  const marker = document.createElement("span");
  marker.textContent = /^\S*/.exec(input.value.slice(index))?.[0] || ".";
  mirror.append(marker);
  document.body.append(mirror);
  const left = marker.offsetLeft;
  mirror.remove();
  return left;
};
