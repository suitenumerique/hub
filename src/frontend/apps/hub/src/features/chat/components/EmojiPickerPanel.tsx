import { EmojiPicker } from "frimousse";
import { useTranslation } from "react-i18next";

import { FluentEmoji } from "./FluentEmoji";

type EmojiPickerPanelProps = {
  onSelect: (emoji: string) => void;
};

// Keep the warm-up requests and Frimousse on the exact same URLs so the
// browser can serve the picker fetches from its HTTP cache on first open.
const EMOJIBASE_URL = "https://cdn.jsdelivr.net/npm/emojibase-data@latest";

// Locales supported by both the app and Frimousse.
const FRIMOUSSE_LOCALES = ["en", "fr", "de", "nl"] as const;
type FrimousseLocale = (typeof FRIMOUSSE_LOCALES)[number];

const toFrimousseLocale = (language: string): FrimousseLocale => {
  const lang = language.slice(0, 2).toLowerCase();
  return (FRIMOUSSE_LOCALES as readonly string[]).includes(lang)
    ? (lang as FrimousseLocale)
    : "en";
};

const dataPreloads = new Map<FrimousseLocale, Promise<void>>();

/** Warm the two datasets Frimousse needs without mounting the whole picker. */
export const preloadEmojiData = (language: string): Promise<void> => {
  const locale = toFrimousseLocale(language);
  const existing = dataPreloads.get(locale);
  if (existing) {
    return existing;
  }

  const preload = Promise.all(
    ["data", "messages"].map(async (file) => {
      const response = await fetch(`${EMOJIBASE_URL}/${locale}/${file}.json`, {
        cache: "force-cache",
      });
      if (!response.ok) {
        throw new Error(`Could not preload Frimousse ${file}.`);
      }
      await response.arrayBuffer();
    }),
  )
    .then(() => undefined)
    .catch(() => {
      // Frimousse will retry normally when opened; allow a future warm-up too.
      dataPreloads.delete(locale);
    });

  dataPreloads.set(locale, preload);
  return preload;
};

/**
 * The headless Frimousse emoji picker, rendering each cell as a Fluent emoji.
 * Lazy-loaded by `EmojiPickerPopover` so `frimousse` stays out of the initial
 * chat bundle. `skinTone` is left at its "none" default — no skin-tone
 * selector is rendered in v1.
 */
const EmojiPickerPanel = ({ onSelect }: EmojiPickerPanelProps) => {
  const { t, i18n } = useTranslation();
  const locale = toFrimousseLocale(i18n.resolvedLanguage ?? i18n.language);

  return (
    <EmojiPicker.Root
      className="hub__emoji-picker"
      locale={locale}
      emojibaseUrl={EMOJIBASE_URL}
      onEmojiSelect={({ emoji }) => onSelect(emoji)}
    >
      <EmojiPicker.Search
        className="hub__emoji-picker__search"
        placeholder={t("Search emoji")}
        autoFocus
      />
      <EmojiPicker.Viewport className="hub__emoji-picker__viewport">
        <EmojiPicker.Loading className="hub__emoji-picker__status">
          {t("Loading emoji…")}
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="hub__emoji-picker__status">
          {t("No emoji found")}
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="hub__emoji-picker__list"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div className="hub__emoji-picker__category" {...props}>
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className="hub__emoji-picker__row" {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                {...props}
                type="button"
                className="hub__emoji-picker__emoji"
                aria-label={emoji.label}
              >
                {/*
                  `flat` (SVG) — tiny (~2 KB) AND cheap to rasterize. `color`
                  SVGs are gradient-heavy: rasterizing dozens per scroll tick
                  froze the main thread. `3d` PNGs are 30-44 KB each.
                */}
                <FluentEmoji
                  emoji={emoji.emoji}
                  size="md"
                  emojiStyle="flat"
                  decorative
                />
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
};

export default EmojiPickerPanel;
