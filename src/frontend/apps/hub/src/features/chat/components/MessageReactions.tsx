import { EmojiAdd, Plus } from '@gouvfr-lasuite/ui-kit/icons';
import clsx from 'clsx';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChatReaction } from '@/features/drivers/types';

import { emojiToCodepoints } from '../fluentEmoji';

import { EmojiPickerPopover } from './EmojiPickerPopover';
import { FluentEmoji } from './FluentEmoji';
import { Button, ButtonElement } from '@gouvfr-lasuite/cunningham-react';

type MessageReactionsProps = {
  reactions: ChatReaction[];
  /** Toggles the current user's reaction with the given emoji. */
  onReact: (emoji: string) => void;
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
  const { t } = useTranslation();
  const addButtonRef = useRef<ButtonElement>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const closePicker = useCallback(() => setIsPickerOpen(false), []);

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
          <Button
            key={emojiToCodepoints(reaction.emoji)}
            size="nano"
            color="neutral"
            variant="bordered"
            className={clsx('hub__message-reactions__chip', {
              'hub__message-reactions__chip--mine': reaction.reactedByMe,
            })}
            aria-pressed={reaction.reactedByMe}
            aria-label={
              reaction.reactedByMe
                ? t('Remove your {{emoji}} reaction ({{total}})', {
                    emoji: reaction.emoji,
                    total: reaction.count,
                  })
                : t('React with {{emoji}} ({{total}})', {
                    emoji: reaction.emoji,
                    total: reaction.count,
                  })
            }
            onClick={() => onReact(reaction.emoji)}
          >
            <FluentEmoji emoji={reaction.emoji} size="xs" decorative />
            <span className="hub__message-reactions__count">
              {reaction.count}
            </span>
          </Button>
        ))}

        <Button
          ref={addButtonRef}
          size="nano"
          color="neutral"
          variant="bordered"
          className="hub__message-reactions__chip "
          aria-label={t('Add a reaction')}
          aria-haspopup="dialog"
          aria-expanded={isPickerOpen}
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
