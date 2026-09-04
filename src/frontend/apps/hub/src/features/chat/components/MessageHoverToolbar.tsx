import {
  DropdownMenu,
  type DropdownMenuItem,
  useDropdownMenu,
} from "@gouvfr-lasuite/ui-components";
import {
  Copy,
  Edit,
  EmojiAdd,
  More,
  Reply,
  Trash,
} from "@gouvfr-lasuite/ui-components/icons";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { EmojiPickerPopover, preloadEmojiPicker } from "./EmojiPickerPopover";
import { FluentEmoji } from "./FluentEmoji";

type MessageHoverToolbarProps = {
  /** Toggles the current user's reaction with the given emoji. */
  onReact: (emoji: string) => void;
  /** Opens a reply flow for this message. Omitted when reply is unavailable. */
  onReply?: () => void;
  onCopy?: () => void | Promise<void>;
  onEdit?: () => void;
  onDelete?: () => void | Promise<unknown>;
  /**
   * Drops the Reply action while keeping reactions and message actions — used
   * for bubbles inside the threads panel.
   */
  compact?: boolean;
};

type QuickReaction = {
  emoji: string;
  label: string;
};

/**
 * Per-bubble hover/focus toolbar (Figma node 13242:2334): quick reactions, an
 * emoji picker trigger, reply, and message actions. Every selection is
 * forwarded through callbacks; the toolbar knows nothing of the data layer.
 * Visibility is driven entirely by CSS — see MessageHoverToolbar.scss. The
 * outer element is a transparent wrapper; the visible pill is `__bar` (the
 * wrapper's padding is the gap to the bubble, kept inside the hover hit-area).
 */
export const MessageHoverToolbar = ({
  onReact,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  compact = false,
}: MessageHoverToolbarProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const actionsMenu = useDropdownMenu();
  // Independent from menu.isOpen on purpose: an outside click may dismiss the
  // dropdown, but the toolbar remains pinned until an action is selected.
  const [areActionsPinned, setAreActionsPinned] = useState(false);

  const closePicker = useCallback(() => setIsPickerOpen(false), []);
  const preloadPicker = useCallback(
    () => preloadEmojiPicker(language),
    [language],
  );
  const quickReactions = useMemo<QuickReaction[]>(
    () => [
      { emoji: "👍", label: t("React with a thumbs up") },
      { emoji: "😂", label: t("React with a laughing face") },
      { emoji: "✅", label: t("React with a check mark") },
    ],
    [t],
  );

  const handlePick = useCallback(
    (emoji: string) => {
      onReact(emoji);
      setIsPickerOpen(false);
    },
    [onReact],
  );

  const anchor = addButtonRef.current;
  const hasMutationAction = Boolean(onEdit || onDelete);
  const actionOptions = useMemo<DropdownMenuItem[]>(
    () => [
      {
        icon: <Copy />,
        label: t("Copy"),
        callback: () => {
          setAreActionsPinned(false);
          void onCopy?.();
        },
      },
      ...(hasMutationAction ? ([{ type: "separator" }] as const) : []),
      ...(onEdit
        ? [
            {
              icon: <Edit />,
              label: t("Edit"),
              callback: () => {
                setAreActionsPinned(false);
                onEdit();
              },
            },
          ]
        : []),
      ...(onDelete
        ? [
            {
              icon: <Trash />,
              label: t("Delete"),
              variant: "danger" as const,
              callback: () => {
                setAreActionsPinned(false);
                // The mutation hook already owns user-facing error reporting;
                // consume its rejection so the menu callback cannot create an
                // unhandled Promise rejection in the browser.
                void Promise.resolve(onDelete()).catch(() => {});
              },
            },
          ]
        : []),
    ],
    [hasMutationAction, onCopy, onDelete, onEdit, t],
  );

  return (
    <div
      className="hub__message-toolbar"
      data-actions-pinned={areActionsPinned || undefined}
    >
      <div className="hub__message-toolbar__bar">
        {quickReactions.map(({ emoji, label }) => (
          <button
            key={emoji}
            type="button"
            className="hub__message-toolbar__button"
            aria-label={label}
            onClick={() => onReact(emoji)}
          >
            <FluentEmoji emoji={emoji} emojiStyle="flat" decorative />
          </button>
        ))}

        <button
          ref={addButtonRef}
          type="button"
          className="hub__message-toolbar__button"
          aria-label={t("Add a reaction")}
          aria-haspopup="dialog"
          aria-expanded={isPickerOpen}
          onPointerEnter={preloadPicker}
          onFocus={preloadPicker}
          onClick={() => setIsPickerOpen((open) => !open)}
        >
          <EmojiAdd size={16} />
        </button>

        {/* A thread reply cannot start a nested thread, so only Reply is hidden. */}
        {!compact && (
          <>
            <span
              className="hub__message-toolbar__separator"
              aria-hidden="true"
            />

            <button
              type="button"
              className="hub__message-toolbar__button hub__message-toolbar__button--labelled"
              disabled={!onReply}
              aria-disabled={!onReply}
              onClick={onReply}
            >
              <Reply size={16} />
              <span className="hub__message-toolbar__label">{t("Reply")}</span>
            </button>
          </>
        )}

        <span className="hub__message-toolbar__separator" aria-hidden="true" />

        <DropdownMenu
          options={actionOptions}
          {...actionsMenu}
          onOpenChange={actionsMenu.setIsOpen}
        >
          <button
            type="button"
            className="hub__message-toolbar__button"
            aria-label={t("More actions")}
            aria-haspopup="menu"
            aria-expanded={actionsMenu.isOpen}
            onClick={() => {
              setIsPickerOpen(false);
              setAreActionsPinned(true);
              actionsMenu.setIsOpen((open) => !open);
            }}
          >
            <More size={16} />
          </button>
        </DropdownMenu>
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
