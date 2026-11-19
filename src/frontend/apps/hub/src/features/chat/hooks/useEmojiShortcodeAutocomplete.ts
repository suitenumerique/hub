import { useQuery } from "@tanstack/react-query";
import { type RefObject, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { chatKeys } from "../chatKeys";
import type { ComposerDraft } from "../composer/composerDraft";
import {
  findShortcodeTrigger,
  matchShortcodes,
  MIN_SHORTCODE_QUERY,
  type ShortcodeEmoji,
  type ShortcodeMatch,
} from "../composer/emojiShortcodes";
import {
  type EmojibaseLocale,
  fetchEmojibase,
  toEmojibaseLocale,
} from "../emojibase";

import {
  useSuggestionList,
  useSuggestionTrigger,
} from "./useComposerSuggestions";

type EmojibaseEmoji = { hexcode: string; emoji: string };
type EmojibaseShortcodes = Record<string, string | string[]>;

/**
 * The emojis that have a shortcode. Element's Slack-style set (iamcal), in
 * English for every language; the emojis come from the picker's own data,
 * often already in the HTTP cache.
 */
const loadShortcodeEmojis = async (
  locale: EmojibaseLocale,
  signal: AbortSignal,
): Promise<ShortcodeEmoji[]> => {
  const [emojis, shortcodes] = await Promise.all([
    fetchEmojibase(`${locale}/data.json`, signal).then(
      (response) => response.json() as Promise<EmojibaseEmoji[]>,
    ),
    fetchEmojibase("en/shortcodes/iamcal.json", signal).then(
      (response) => response.json() as Promise<EmojibaseShortcodes>,
    ),
  ]);
  return emojis.flatMap(({ hexcode, emoji }) => {
    const codes = shortcodes[hexcode];
    if (!codes) {
      return [];
    }
    return [{ emoji, shortcodes: typeof codes === "string" ? [codes] : codes }];
  });
};

// The emoji, not its shortcode: the one shown can change as the text refines.
const matchKey = (match: ShortcodeMatch) => match.emoji;

type UseEmojiShortcodeAutocompleteOptions = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  draftRef: RefObject<ComposerDraft>;
  replaceRange: (start: number, end: number, replacement: string) => void;
  /** Called once an emoji replaced the shortcode. */
  onInserted: () => void;
  disabled: boolean;
};

/**
 * The emojis offered for a `:shortcode`, from two characters after the `:`,
 * with the keys of the `@` suggestions: arrows move the selection, Enter or
 * Tab replaces the shortcode with the emoji, Escape hides the list until the
 * next keystroke. The textarea keeps the focus throughout.
 */
export const useEmojiShortcodeAutocomplete = ({
  inputRef,
  draftRef,
  replaceRange,
  onInserted,
  disabled,
}: UseEmojiShortcodeAutocompleteOptions) => {
  const { i18n } = useTranslation();
  const locale = toEmojibaseLocale(i18n.resolvedLanguage ?? i18n.language);
  const { trigger, isWanted, selectedKey, select, close, ...typing } =
    useSuggestionTrigger({
      inputRef,
      draftRef,
      findTrigger: findShortcodeTrigger,
    });
  // The emojis load once someone types `:`, then stay available.
  const { data: emojis } = useQuery({
    queryKey: chatKeys.emojiShortcodes(locale),
    queryFn: ({ signal }) => loadShortcodeEmojis(locale, signal),
    enabled: isWanted,
    staleTime: Infinity,
    gcTime: Infinity,
    meta: { noGlobalError: true },
  });
  const items = useMemo(
    () =>
      emojis && trigger && trigger.query.length >= MIN_SHORTCODE_QUERY
        ? matchShortcodes(emojis, trigger.query)
        : [],
    [emojis, trigger],
  );
  const isOpen = !disabled && items.length > 0;

  const confirm = useCallback(
    (item: ShortcodeMatch | undefined) => {
      const input = inputRef.current;
      if (!trigger || !input || !item) {
        return;
      }
      const { text } = draftRef.current;
      // With the caret inside a shortcode, up to its closing `:`. A word
      // glued after it stays, as does what follows one already closed.
      let end = input.selectionEnd;
      if (!/.:$/.test(text.slice(trigger.start, end))) {
        end += /^[\w+-]*:/.exec(text.slice(end))?.[0].length ?? 0;
      }
      close();
      replaceRange(trigger.start, end, item.emoji);
      onInserted();
    },
    [close, draftRef, inputRef, onInserted, replaceRange, trigger],
  );

  const list = useSuggestionList({
    items,
    getKey: matchKey,
    isOpen,
    selectedKey,
    select,
    onConfirm: confirm,
    onClose: close,
  });

  return {
    isOpen,
    items,
    /** Where the `:` of the shortcode being typed stands in the text. */
    triggerStart: trigger?.start ?? 0,
    ...list,
    ...typing,
    onBlur: close,
    confirm,
  };
};
