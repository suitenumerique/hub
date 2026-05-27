import { EmojiAdd, More, Reply } from "@gouvfr-lasuite/ui-kit/icons";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { FluentEmoji } from "./FluentEmoji";

type MessageHoverToolbarProps = {
  /** Toggles the current user's reaction with the given emoji. */
  onReact: (emoji: string) => void;
};

type QuickReaction = {
  emoji: string;
  /** i18n key for the button's accessible label. */
  labelKey: string;
};

// Matches the Figma toolbar (emoji-thumbs-up, emoji-face-with-tears-of-joy).
const QUICK_REACTIONS: QuickReaction[] = [
  { emoji: "👍", labelKey: "React with a thumbs up" },
  { emoji: "😂", labelKey: "React with a laughing face" },
];

/**
 * Per-bubble hover/focus toolbar (Figma node 13242:2334): quick reactions, an
 * emoji picker trigger, and inert Reply / More buttons. Purely presentational —
 * every reaction selection is forwarded through `onReact`; the toolbar knows
 * nothing of the data layer. Visibility is driven entirely by CSS — see
 * MessageHoverToolbar.scss. The outer element is a transparent wrapper; the
 * visible pill is `__bar` (the wrapper's padding is the gap to the bubble,
 * kept inside the hover hit-area).
 */
export const MessageHoverToolbar = ({ onReact }: MessageHoverToolbarProps) => {
  const { t } = useTranslation();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const closePicker = useCallback(() => setIsPickerOpen(false), []);

  const handlePick = useCallback(
    (emoji: string) => {
      onReact(emoji);
      setIsPickerOpen(false);
    },
    [onReact],
  );

  const anchor = addButtonRef.current;

  return (
    <div className="hub__message-toolbar">
      <div className="hub__message-toolbar__bar">
        {QUICK_REACTIONS.map(({ emoji, labelKey }) => (
          <button
            key={emoji}
            type="button"
            className="hub__message-toolbar__button"
            aria-label={t(labelKey)}
            onClick={() => onReact(emoji)}
          >
            <FluentEmoji emoji={emoji} decorative />
          </button>
        ))}

        <button
          ref={addButtonRef}
          type="button"
          className="hub__message-toolbar__button"
          aria-label={t("Add a reaction")}
          aria-haspopup="dialog"
          aria-expanded={isPickerOpen}
          onClick={() => setIsPickerOpen((open) => !open)}
        >
          <EmojiAdd size={16} />
        </button>

        <span className="hub__message-toolbar__separator" aria-hidden="true" />

        {/* Inert — Reply is wired in a later change. */}
        <button
          type="button"
          className="hub__message-toolbar__button hub__message-toolbar__button--labelled"
        >
          <Reply size={16} />
          <span className="hub__message-toolbar__label">{t("Reply")}</span>
        </button>

        <span className="hub__message-toolbar__separator" aria-hidden="true" />

        {/* Inert — More is wired in a later change. */}
        <button
          type="button"
          className="hub__message-toolbar__button"
          aria-label={t("More actions")}
        >
          <More size={16} />
        </button>
      </div>

      {isPickerOpen && anchor && (
        <EmojiPickerPopover
          anchor={anchor}
          onSelect={handlePick}
          onClose={closePicker}
        />
      )}
    </div>
  );
};
