import { EmojiAdd, Plus } from "@gouvfr-lasuite/ui-components/icons";
import clsx from "clsx";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ChatReaction } from "@/features/drivers/types";

import { emojiToCodepoints } from "../fluentEmoji";

import { EmojiPickerPopover, preloadEmojiPicker } from "./EmojiPickerPopover";
import { FluentEmoji } from "./FluentEmoji";
import { Button, ButtonElement, Tooltip } from "@gouvfr-lasuite/ui-components";

/** Names listed in a chip's tooltip before "and N others", as in Element. */
const MAX_LISTED_SENDERS = 6;

/** Room kept between an unfolded tooltip and the edge of the visible area. */
const VISIBLE_AREA_MARGIN = 40;

type MessageReactionsProps = {
  reactions: ChatReaction[];
  /** Toggles the current user's reaction with the given emoji. */
  onReact: (emoji: string) => void;
};

/**
 * Top and bottom of the area that can show `element`: the window, narrowed by
 * the ancestors that clip what overflows them, such as the message list.
 */
const visibleArea = (element: Element) => {
  let top = 0;
  let bottom = window.innerHeight;
  for (let el = element.parentElement; el; el = el.parentElement) {
    if (getComputedStyle(el).overflowY !== "visible") {
      const rect = el.getBoundingClientRect();
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
    }
  }
  return { top, bottom };
};

/**
 * Height the sender list may take in its tooltip: up to the edge of the
 * visible area, less the margin, on the side the tooltip opened. Null when the
 * tooltip or its chip cannot be found.
 */
const sendersMaxHeight = (list: HTMLElement): number | null => {
  const tooltip = list.closest<HTMLElement>(".c__tooltip");
  // The open tooltip describes its chip.
  const chip =
    tooltip &&
    document.querySelector(`[aria-describedby="${CSS.escape(tooltip.id)}"]`);
  if (!tooltip || !chip) {
    return null;
  }
  const style = getComputedStyle(tooltip);
  const frame =
    parseFloat(style.paddingTop) +
    parseFloat(style.paddingBottom) +
    parseFloat(style.borderTopWidth) +
    parseFloat(style.borderBottomWidth);
  const chipRect = chip.getBoundingClientRect();
  const area = visibleArea(chip);
  const space =
    tooltip.dataset.placement === "bottom"
      ? area.bottom -
        VISIBLE_AREA_MARGIN -
        chipRect.bottom -
        parseFloat(style.marginTop)
      : chipRect.top -
        parseFloat(style.marginBottom) -
        (area.top + VISIBLE_AREA_MARGIN);
  return space - frame;
};

/**
 * Who reacted with a chip's emoji, one name per line (Figma node 2192:9673):
 * the first ones in the order they reacted, then how many others did. Clicking
 * "and N others" lists everyone; the list then grows on the side the tooltip
 * opened, as far as the visible area allows, and scrolls beyond.
 */
const ReactionSenders = ({ reaction }: { reaction: ChatReaction }) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLSpanElement>(null);
  const [isUnfolded, setIsUnfolded] = useState(false);
  const senders = reaction.senders ?? [];
  const listed = isUnfolded ? senders : senders.slice(0, MAX_LISTED_SENDERS);
  const others = reaction.count - listed.length;
  const othersLabel = t("and {{count}} others", {
    count: others,
    description:
      "Last line of a reaction tooltip, after the names of the first people who reacted. Clicking it lists them all.",
  });

  const unfold = () => {
    const list = listRef.current;
    const maxHeight = list && sendersMaxHeight(list);
    if (list && maxHeight !== null) {
      // Never smaller than the folded list, even with little room left.
      list.style.setProperty(
        "--hub-reaction-senders-max-height",
        `${Math.max(maxHeight, list.offsetHeight)}px`,
      );
    }
    setIsUnfolded(true);
  };

  return (
    <span ref={listRef} className="hub__message-reactions__senders">
      {listed.map((sender) => (
        <span key={sender.id} className="hub__message-reactions__sender">
          {sender.name}
        </span>
      ))}
      {others > 0 &&
        (senders.length > listed.length ? (
          // The tooltip closes as soon as its chip loses focus, so this button
          // is for the pointer only and must not take the focus.
          <button
            type="button"
            tabIndex={-1}
            className="hub__message-reactions__sender hub__message-reactions__more"
            onMouseDown={(event) => event.preventDefault()}
            onClick={unfold}
          >
            {othersLabel}
          </button>
        ) : (
          <span className="hub__message-reactions__sender">{othersLabel}</span>
        ))}
    </span>
  );
};

/**
 * The persistent bar of aggregated reaction chips shown below a message bubble
 * (Figma node 1219:177055). Renders nothing when the message has no reactions —
 * the first reaction is added from the hover toolbar. Each chip toggles its own
 * emoji; the trailing button opens the emoji picker to add another.
 */
export const MessageReactions = ({
  reactions,
  onReact,
}: MessageReactionsProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const addButtonRef = useRef<ButtonElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const closePicker = useCallback(() => setIsPickerOpen(false), []);
  const preloadPicker = useCallback(
    () => preloadEmojiPicker(language),
    [language],
  );

  const handlePick = useCallback(
    (emoji: string) => {
      onReact(emoji);
      setIsPickerOpen(false);
    },
    [onReact],
  );

  if (reactions.length === 0) {
    return null;
  }

  const anchor = addButtonRef.current;

  return (
    <div className="hub__message-reactions">
      <div className="hub__message-reactions__list">
        {reactions.map((reaction) => (
          <Tooltip
            key={emojiToCodepoints(reaction.emoji)}
            content={<ReactionSenders reaction={reaction} />}
            placement="top"
            className="hub__delayed-tooltip hub__message-reactions__tooltip"
          >
            <Button
              size="nano"
              color="neutral"
              variant="bordered"
              className={clsx("hub__message-reactions__chip", {
                "hub__message-reactions__chip--mine": reaction.reactedByMe,
              })}
              aria-pressed={reaction.reactedByMe}
              aria-label={
                reaction.reactedByMe
                  ? t("Remove your {{emoji}} reaction ({{total}})", {
                      emoji: reaction.emoji,
                      total: reaction.count,
                    })
                  : t("React with {{emoji}} ({{total}})", {
                      emoji: reaction.emoji,
                      total: reaction.count,
                    })
              }
              onClick={() => onReact(reaction.emoji)}
            >
              <FluentEmoji
                emoji={reaction.emoji}
                size="xs"
                emojiStyle="flat"
                decorative
              />
              <span className="hub__message-reactions__count">
                {reaction.count}
              </span>
            </Button>
          </Tooltip>
        ))}

        <Button
          ref={addButtonRef}
          size="nano"
          color="neutral"
          variant="bordered"
          className="hub__message-reactions__chip "
          aria-label={t("Add a reaction")}
          aria-haspopup="dialog"
          aria-expanded={isPickerOpen}
          onPointerEnter={preloadPicker}
          onFocus={preloadPicker}
          onClick={() => setIsPickerOpen((open) => !open)}
        >
          <EmojiAdd size={16} /> <Plus size={16} />
        </Button>
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
