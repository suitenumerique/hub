import { Button, Tooltip } from "@gouvfr-lasuite/ui-components";
import { Emoji } from "@gouvfr-lasuite/ui-components/icons";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { EmojiPickerPopover, preloadEmojiPicker } from "./EmojiPickerPopover";

type ComposerEmojiButtonProps = {
  /** The composer's field, where the emoji goes. */
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /** Writes over `start`–`end` of the field and gives it the focus back. */
  replaceRange: (start: number, end: number, replacement: string) => void;
  disabled: boolean;
  /** Called once a picked emoji is in the text. */
  onInserted: () => void;
};

/**
 * The composer's emoji button and its picker (Figma 4040:14344). The emoji
 * goes where the caret was, or over the selection, the caret right after it.
 * Leaving the picker without a pick, from the keyboard or the button, goes
 * back to the text as it was.
 */
export const ComposerEmojiButton = ({
  inputRef,
  replaceRange,
  disabled,
  onInserted,
}: ComposerEmojiButtonProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  // The button while its picker is open. Taken from the click: the tooltip
  // around the button sets its own ref on it.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // The text the emoji replaces, held while the focus is in the picker.
  const rangeRef = useRef({ start: 0, end: 0 });
  const label = t("Add an emoji");

  const preload = useCallback(() => preloadEmojiPicker(language), [language]);

  const close = useCallback(() => setAnchor(null), []);

  const returnToText = useCallback(() => {
    const { start, end } = rangeRef.current;
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(start, end);
  }, [inputRef]);

  const toggle = (button: HTMLElement) => {
    if (anchor) {
      close();
      returnToText();
      return;
    }
    const input = inputRef.current;
    if (!input) {
      return;
    }
    rangeRef.current = { start: input.selectionStart, end: input.selectionEnd };
    setAnchor(button);
  };

  const insert = useCallback(
    (emoji: string) => {
      setAnchor(null);
      const { start, end } = rangeRef.current;
      // Takes the focus back, the caret after the emoji, in one undo step.
      replaceRange(start, end, emoji);
      onInserted();
    },
    [onInserted, replaceRange],
  );

  // A composer that can no longer be typed in drops its picker.
  useEffect(() => {
    if (disabled) {
      setAnchor(null);
    }
  }, [disabled]);

  return (
    <>
      <Tooltip content={label} placement="top" className="hub__delayed-tooltip">
        <Button
          type="button"
          size="nano"
          variant="tertiary"
          color="neutral"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={Boolean(anchor)}
          icon={<Emoji size={16} aria-hidden="true" />}
          disabled={disabled}
          onPointerEnter={preload}
          onFocus={preload}
          onClick={(event) => toggle(event.currentTarget)}
        />
      </Tooltip>
      {anchor && (
        <EmojiPickerPopover
          anchor={anchor}
          align="end"
          closeOnScroll={false}
          onRestoreFocus={returnToText}
          onSelect={insert}
          onClose={close}
        />
      )}
    </>
  );
};
