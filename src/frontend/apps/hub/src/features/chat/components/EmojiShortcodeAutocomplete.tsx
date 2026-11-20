import clsx from "clsx";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { caretLeft } from "../composer/caretLeft";
import type { ShortcodeMatch } from "../composer/emojiShortcodes";
import { useSelectedOptionInView } from "../hooks/useSelectedOptionInView";

import { FluentEmoji } from "./FluentEmoji";

type EmojiShortcodeAutocompleteProps = {
  id: string;
  /** The composer's textarea, where the shortcode is typed. */
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /** Where the `:` of the shortcode stands in the text. */
  triggerStart: number;
  items: ShortcodeMatch[];
  selectedIndex: number;
  optionId: (item: ShortcodeMatch) => string;
  onConfirm: (item: ShortcodeMatch) => void;
};

/**
 * The emojis matching the `:shortcode` being typed, above the composer and
 * lined up with the `:`. As for mentions, the textarea keeps the focus and
 * points at the selected row through `aria-activedescendant`.
 */
export const EmojiShortcodeAutocomplete = ({
  id,
  inputRef,
  triggerStart,
  items,
  selectedIndex,
  optionId,
  onConfirm,
}: EmojiShortcodeAutocompleteProps) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);

  // Positioned imperatively, as the emoji picker: only the runtime left
  // edge is set here, the rest stays in SCSS.
  useLayoutEffect(() => {
    const list = listRef.current;
    const input = inputRef.current;
    const container = list?.offsetParent;
    if (!list || !input || !container) {
      return;
    }
    const inputLeft =
      input.getBoundingClientRect().left -
      container.getBoundingClientRect().left;
    // Measured again as the shortcode grows: it can wrap to the next line.
    const colon = inputLeft + caretLeft(input, triggerStart) - input.scrollLeft;
    // The emojis line up under the `:`, the list staying in the composer.
    const left = colon - parseFloat(getComputedStyle(list).paddingLeft);
    const maxLeft = container.clientWidth - list.offsetWidth;
    list.style.left = `${Math.max(0, Math.min(left, maxLeft))}px`;
  }, [inputRef, items, triggerStart]);

  useSelectedOptionInView(listRef, selectedIndex, items);

  return (
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      aria-label={t("Emoji suggestions")}
      className="hub__emoji-autocomplete"
    >
      {items.map((item, index) => {
        const { shortcode, matchStart, matchLength } = item;
        const matchEnd = matchStart + matchLength;
        return (
          <li
            key={item.emoji}
            id={optionId(item)}
            role="option"
            aria-selected={index === selectedIndex}
            className={clsx(
              "hub__emoji-autocomplete__option",
              index === selectedIndex &&
                "hub__emoji-autocomplete__option--selected",
            )}
            // Keep the focus in the composer, touch included.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onConfirm(item)}
          >
            <span className="hub__emoji-autocomplete__emoji">
              <FluentEmoji emoji={item.emoji} size="xs" />
            </span>
            <span className="hub__emoji-autocomplete__shortcode">
              :{shortcode.slice(0, matchStart)}
              <strong className="hub__emoji-autocomplete__match">
                {shortcode.slice(matchStart, matchEnd)}
              </strong>
              {shortcode.slice(matchEnd)}:
            </span>
          </li>
        );
      })}
    </ul>
  );
};
