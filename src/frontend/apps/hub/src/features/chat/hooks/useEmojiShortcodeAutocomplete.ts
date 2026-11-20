import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { type RefObject, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { chatKeys } from "../chatKeys";
import type { ComposerDraft } from "../composer/composerDraft";
import {
  findClosedShortcode,
  findShortcodeTrigger,
  matchShortcodes,
  MIN_SHORTCODE_QUERY,
  replaceShortcodes,
  type ShortcodeEmoji,
  shortcodeLookup,
  type ShortcodeMatch,
  shortcodeRestLength,
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

type EmojibaseEmoji = { hexcode: string; emoji: string; tags?: string[] };
type EmojibaseShortcodes = Record<string, string | string[]>;

const fetchShortcodes = (path: string, signal?: AbortSignal) =>
  fetchEmojibase(path, signal).then(
    (response) => response.json() as Promise<EmojibaseShortcodes>,
  );

const asList = (codes: string | string[] | undefined) =>
  typeof codes === "string" ? [codes] : (codes ?? []);

/**
 * The emojis that have a shortcode: in the UI language as the picker's search
 * (CLDR's `coeur_rouge`), and Element's Slack-style English ones (`heart`)
 * in every language, with the picker's keywords (`mdr`). The emojis come
 * from the picker's own data, often already in the HTTP cache.
 */
const loadShortcodeEmojis = async (
  locale: EmojibaseLocale,
  signal?: AbortSignal,
): Promise<ShortcodeEmoji[]> => {
  const [emojis, english, local] = await Promise.all([
    fetchEmojibase(`${locale}/data.json`, signal).then(
      (response) => response.json() as Promise<EmojibaseEmoji[]>,
    ),
    fetchShortcodes("en/shortcodes/iamcal.json", signal),
    locale === "en"
      ? undefined
      : fetchShortcodes(`${locale}/shortcodes/cldr.json`, signal),
  ]);
  return emojis.flatMap(({ hexcode, emoji, tags }) => {
    const shortcodes = [
      ...asList(local?.[hexcode]),
      ...asList(english[hexcode]),
    ];
    return shortcodes.length > 0 ? [{ emoji, shortcodes, keywords: tags }] : [];
  });
};

const shortcodesQuery = (locale: EmojibaseLocale) =>
  queryOptions({
    queryKey: chatKeys.emojiShortcodes(locale),
    queryFn: ({ signal }) => loadShortcodeEmojis(locale, signal),
    staleTime: Infinity,
    gcTime: Infinity,
    meta: { noGlobalError: true },
  });

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
 * next keystroke. The textarea keeps the focus throughout. A shortcode typed
 * or pasted in full (`:santa:`) turns into its emoji, as in Slack.
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
  const queryClient = useQueryClient();
  const {
    trigger,
    isWanted,
    selectedKey,
    select,
    close,
    onInput: followInput,
    ...typing
  } = useSuggestionTrigger({
    inputRef,
    draftRef,
    findTrigger: findShortcodeTrigger,
  });
  // The emojis load once someone types `:`, then stay available.
  const { data: emojis } = useQuery({
    ...shortcodesQuery(locale),
    enabled: isWanted,
  });
  const lookup = useMemo(
    () => (emojis ? shortcodeLookup(emojis) : null),
    [emojis],
  );
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
        end += shortcodeRestLength(text, end);
      }
      close();
      replaceRange(trigger.start, end, item.emoji);
      onInserted();
    },
    [close, draftRef, inputRef, onInserted, replaceRange, trigger],
  );

  /** Follows each edit, and turns a shortcode just closed into its emoji. */
  const onInput = useCallback(
    (inputType: string, draft: ComposerDraft, caret: number) => {
      followInput(inputType, draft, caret);
      const found =
        lookup && !disabled && inputType === "insertText"
          ? findClosedShortcode(draft.text, caret, draft.mentions, lookup)
          : null;
      if (!found) {
        return;
      }
      // Once this input event is over: replaced during it, the controlled
      // textarea would put the text back. Its own undo step brings back the
      // shortcode.
      queueMicrotask(() => {
        if (inputRef.current?.value !== draft.text) {
          return;
        }
        close();
        replaceRange(found.start, caret, found.emoji);
        onInserted();
      });
    },
    [close, disabled, followInput, inputRef, lookup, onInserted, replaceRange],
  );

  /** Turns the shortcodes of a text just pasted at `start` into emojis. */
  const onPasted = useCallback(
    async (start: number, pasted: string) => {
      const text = pasted.replace(/\r\n?/g, "\n");
      if (disabled || !/:[^\s:]+:/u.test(text)) {
        return;
      }
      const pastedLookup =
        lookup ??
        shortcodeLookup(
          await queryClient.fetchQuery(shortcodesQuery(locale)).catch(() => []),
        );
      const value = inputRef.current?.value ?? "";
      const end = start + text.length;
      // Left as pasted if the text changed meanwhile.
      if (value.slice(start, end) !== text) {
        return;
      }
      const replaced = replaceShortcodes(
        text,
        pastedLookup,
        value.slice(0, start),
      );
      if (replaced !== text) {
        replaceRange(start, end, replaced);
      }
    },
    [disabled, inputRef, locale, lookup, queryClient, replaceRange],
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
    onInput,
    onPasted,
    onBlur: close,
    confirm,
  };
};
