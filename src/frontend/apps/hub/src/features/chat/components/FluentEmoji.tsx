import clsx from "clsx";
import { useState } from "react";

import { type FluentEmojiStyle, fluentEmojiUrl } from "../fluentEmoji";

type FluentEmojiSize = "xs" | "sm" | "md";

type FluentEmojiProps = {
  /** Native emoji character, e.g. "👍". */
  emoji: string;
  /** Accessible name. Ignored when `decorative`. Defaults to the emoji itself. */
  label?: string;
  /** Discrete rendered size. */
  size?: FluentEmojiSize;
  /**
   * Fluent asset style. `color` (SVG) is far lighter than `3d` (PNG) — prefer
   * it for long, virtualized lists such as the emoji picker.
   */
  emojiStyle?: FluentEmojiStyle;
  /** Hide from assistive tech — for use inside a control with its own name. */
  decorative?: boolean;
  className?: string;
};

/**
 * Renders an emoji as a Fluent UI asset, falling back to the native glyph
 * when the asset fails to load — the CDN mirror does not cover every emoji.
 */
export const FluentEmoji = ({
  emoji,
  label,
  size = "sm",
  emojiStyle = "3d",
  decorative = false,
  className,
}: FluentEmojiProps) => {
  // Tracked per-URL so a recycled instance (e.g. a virtualized picker cell)
  // retries the asset when it receives a different emoji.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = fluentEmojiUrl(emoji, emojiStyle);
  const accessibleName = label ?? emoji;

  if (failedUrl === url) {
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
      onError={() => setFailedUrl(url)}
    />
  );
};
