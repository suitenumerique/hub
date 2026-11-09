import {
  Copy,
  Download,
  Edit,
  EmojiAdd,
  Reply,
  Retry,
  Trash,
} from "@gouvfr-lasuite/ui-components/icons";
import {
  Fragment,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { EmojiPickerPopover, preloadEmojiPicker } from "./EmojiPickerPopover";
import { FluentEmoji } from "./FluentEmoji";

type MessageHoverToolbarProps = {
  /**
   * Toggles the current user's reaction with the given emoji. Omitted for a
   * message the server does not have: the reactions then leave the menu.
   */
  onReact?: (emoji: string) => void;
  /** Opens a reply flow for this message. Omitted when reply is unavailable. */
  onReply?: () => void;
  /** Sends again a message that could not be sent. */
  onRetry?: () => void;
  /** Omitted for a file without caption: there is no text to copy. */
  onCopy?: () => void | Promise<void>;
  /** Saves the file carried by the message. */
  onDownload?: () => void;
  onEdit?: () => void;
  onDelete?: () => void | Promise<unknown>;
  /**
   * Drops the Reply action while keeping reactions and message actions — used
   * for bubbles inside the threads panel.
   */
  compact?: boolean;
  /**
   * Opened by a right click on the bubble, at the pointer, or by its "more"
   * button, under it.
   */
  isOpen?: boolean;
  /** Called once an action is chosen or the open menu is dismissed. */
  onClose?: () => void;
  /** The "more" button: a press on it toggles the menu itself. */
  triggerRef?: RefObject<HTMLElement | null>;
};

type QuickReaction = {
  emoji: string;
  label: string;
};

type Action = {
  icon: ReactNode;
  label: string;
  /** Omitted while the action is unavailable: it then shows disabled. */
  run?: () => unknown;
};

/**
 * Per-bubble actions menu (Figma node 3629:98707): quick reactions and an
 * emoji picker trigger, reply, then the message actions. Every selection is
 * forwarded through callbacks; the menu knows nothing of the data layer. A
 * right click on the bubble opens it at the pointer, the "more" button beside
 * the bubble under itself (`isOpen`), and it then closes as a context menu
 * does. From the keyboard, it also shows beside the bubble while one of its
 * buttons has the focus — see MessageHoverToolbar.scss.
 */
export const MessageHoverToolbar = ({
  onReact,
  onReply,
  onRetry,
  onCopy,
  onDownload,
  onEdit,
  onDelete,
  compact = false,
  isOpen = false,
  onClose,
  triggerRef,
}: MessageHoverToolbarProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const rootRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // An action is chosen, or the menu opened at the pointer is dismissed.
  const finish = useCallback(() => {
    setIsPickerOpen(false);
    onClose?.();
  }, [onClose]);

  // Once open, the menu closes as a context menu does: on a press outside it
  // and its "more" button, on Escape or when something scrolls. The emoji
  // picker, in its own layer, is dismissed first.
  useEffect(() => {
    if (!isOpen || isPickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !triggerRef?.current?.contains(target)
      ) {
        finish();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Handled: the tools panel over the conversation stays open.
        event.preventDefault();
        finish();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", finish, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("scroll", finish, true);
    };
  }, [finish, isOpen, isPickerOpen, triggerRef]);

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
      onReact?.(emoji);
      finish();
    },
    [finish, onReact],
  );

  const anchor = addButtonRef.current;
  // Reply and the actions reading the message, then those changing it, each
  // group after a separator.
  const groups: Action[][] = [
    [
      // A thread reply cannot start a nested thread, so only Reply is hidden.
      ...(compact
        ? []
        : [{ icon: <Reply size={16} />, label: t("Reply"), run: onReply }]),
      ...(onCopy
        ? [{ icon: <Copy size={16} />, label: t("Copy"), run: onCopy }]
        : []),
      ...(onDownload
        ? [
            {
              icon: <Download size={16} />,
              label: t("Download"),
              run: onDownload,
            },
          ]
        : []),
    ],
    [
      ...(onRetry
        ? [{ icon: <Retry size={16} />, label: t("Retry"), run: onRetry }]
        : []),
      ...(onEdit
        ? [{ icon: <Edit size={16} />, label: t("Edit"), run: onEdit }]
        : []),
      ...(onDelete
        ? [{ icon: <Trash size={16} />, label: t("Delete"), run: onDelete }]
        : []),
    ],
  ].filter((group) => group.length > 0);

  return (
    <div ref={rootRef} className="hub__message-toolbar">
      {onReact && (
        <div className="hub__message-toolbar__reactions">
          {quickReactions.map(({ emoji, label }) => (
            <button
              key={emoji}
              type="button"
              className="hub__message-toolbar__button"
              aria-label={label}
              onClick={() => {
                onReact(emoji);
                finish();
              }}
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
        </div>
      )}

      {groups.map((group, index) => (
        <Fragment key={group[0].label}>
          {(onReact || index > 0) && (
            <span
              className="hub__message-toolbar__separator"
              aria-hidden="true"
            />
          )}
          {group.map(({ icon, label, run }) => (
            <button
              key={label}
              type="button"
              className="hub__message-toolbar__item"
              disabled={!run}
              aria-disabled={!run}
              onClick={() => {
                finish();
                // The hooks behind the actions already report their errors:
                // consume a rejection so it never goes unhandled.
                void Promise.resolve(run?.()).catch(() => {});
              }}
            >
              <span
                className="hub__message-toolbar__item__icon"
                aria-hidden="true"
              >
                {icon}
              </span>
              {label}
            </button>
          ))}
        </Fragment>
      ))}

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
