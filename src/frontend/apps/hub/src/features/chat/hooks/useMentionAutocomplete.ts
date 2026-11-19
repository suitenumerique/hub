import { type RefObject, useCallback, useMemo } from "react";

import type { ComposerDraft } from "../composer/composerDraft";
import {
  buildMentionIndex,
  type MentionCandidate,
  rankMentionCandidates,
} from "../composer/mentionMatching";
import { findMentionTrigger } from "../composer/mentionTrigger";

import {
  useSuggestionList,
  useSuggestionTrigger,
} from "./useComposerSuggestions";
import {
  type ComposerMentionSource,
  useMentionCandidates,
} from "./useMentionCandidates";

const candidateKey = (candidate: MentionCandidate) => candidate.id;

type UseMentionAutocompleteOptions = {
  source: ComposerMentionSource | undefined;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  draftRef: RefObject<ComposerDraft>;
  insertMention: (
    start: number,
    end: number,
    mention: { userId: string; name: string },
    suffix: string,
  ) => void;
  disabled: boolean;
};

/**
 * The `@` suggestions of a composer, with Element's keys: arrows move the
 * selection, Enter or Tab inserts it, Escape hides the list until the next
 * keystroke. The textarea keeps the focus throughout.
 */
export const useMentionAutocomplete = ({
  source,
  inputRef,
  draftRef,
  insertMention,
  disabled,
}: UseMentionAutocompleteOptions) => {
  const { trigger, isWanted, selectedKey, select, close, ...typing } =
    useSuggestionTrigger({
      inputRef,
      draftRef,
      findTrigger: findMentionTrigger,
      enabled: Boolean(source),
    });
  // Members load once someone types `@`, then stay available.
  const { candidates, recentSpeakerIds } = useMentionCandidates(
    source,
    isWanted,
  );
  const index = useMemo(() => buildMentionIndex(candidates), [candidates]);
  const items = useMemo(
    () =>
      trigger
        ? rankMentionCandidates(index, trigger.query, recentSpeakerIds)
        : [],
    [index, recentSpeakerIds, trigger],
  );
  const isOpen = Boolean(source) && !disabled && items.length > 0;

  const confirm = useCallback(
    (item: MentionCandidate | undefined) => {
      const input = inputRef.current;
      if (!trigger || !input || !item) {
        return;
      }
      const { text } = draftRef.current;
      // The whole `@word`, even with the caret in its middle.
      let end = input.selectionEnd;
      end += /^\S*/.exec(text.slice(end))?.[0].length ?? 0;
      // Reuse a space already there rather than doubling it.
      if (text[end] === " ") {
        end += 1;
      }
      close();
      insertMention(
        trigger.start,
        end,
        { userId: item.id, name: item.rawName.replace(/\s+/g, " ").trim() },
        trigger.start === 0 ? ": " : " ",
      );
    },
    [close, draftRef, inputRef, insertMention, trigger],
  );

  const list = useSuggestionList({
    items,
    getKey: candidateKey,
    isOpen,
    selectedKey,
    select,
    onConfirm: confirm,
    onClose: close,
  });

  return {
    isOpen,
    items,
    ...list,
    ...typing,
    onBlur: close,
    confirm,
  };
};
