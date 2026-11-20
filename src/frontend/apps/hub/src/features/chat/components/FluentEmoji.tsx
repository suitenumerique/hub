import clsx from "clsx";

import { useFluentEmojiUrl } from "../hooks/useFluentEmojiUrl";

type FluentEmojiSize = "xs" | "sm" | "md";

type FluentEmojiProps = {
  /** Native emoji character, e.g. "👍". */
  emoji: string;
  /** Accessible name. Ignored when `decorative`. Defaults to the emoji itself. */
  label?: string;
  /** Discrete rendered size. */
  size?: FluentEmojiSize;
  /** Hide from assistive tech — for use inside a control with its own name. */
  decorative?: boolean;
  className?: string;
};

/**
 * Renders an emoji as its Fluent UI drawing, falling back to the native glyph
 * when the Hub has none for it.
 */
export const FluentEmoji = ({
  emoji,
  label,
  size = "sm",
  decorative = false,
  className,
}: FluentEmojiProps) => {
  const { url, onError } = useFluentEmojiUrl(emoji);
  const accessibleName = label ?? emoji;

  if (!url) {
    return (
      <span
        className={clsx(
          "hub__fluent-emoji",
          "hub__fluent-emoji--native",
          `hub__fluent-emoji--${size}`,
          className,
        )}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : accessibleName}
        aria-hidden={decorative || undefined}
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      className={clsx(
        "hub__fluent-emoji",
        `hub__fluent-emoji--${size}`,
        className,
      )}
      src={url}
      alt={decorative ? "" : accessibleName}
      draggable={false}
      // No `loading="lazy"`: the picker list is already virtualized, so lazy
      // loading only adds a second deferral layer and re-evaluates on every
      // remount — causing visible pop-in even for cached emoji.
      decoding="async"
      onError={onError}
    />
  );
};
