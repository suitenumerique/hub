import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";

import type { ComposerDraft } from "../composer/composerDraft";
import {
  buildMentionIndex,
  type MentionCandidate,
  rankMentionCandidates,
} from "../composer/mentionMatching";
import {
  findMentionTrigger,
  type MentionTrigger,
} from "../composer/mentionTrigger";

import {
  type ComposerMentionSource,
  useMentionCandidates,
} from "./useMentionCandidates";

/** Edits that never start a mention: pasted, dropped or restored text. */
const isPassiveInput = (inputType: string) =>
  inputType.startsWith("insertFrom") ||
  inputType.startsWith("history") ||
  inputType === "insertReplacementText";

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
  const listId = useId();
  const [trigger, setTrigger] = useState<MentionTrigger | null>(null);
  // Members load once someone types `@`, then stay available.
  const [isWanted, setIsWanted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  // Keep the selected person while the list refines, else the first one.
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.id === selectedId),
  );

  const optionId = useCallback(
    (item: MentionCandidate) => `${listId}-${item.id}`,
    [listId],
  );

  const close = useCallback(() => {
    setTrigger(null);
    setSelectedId(null);
  }, []);

  /** Follows the text after each edit of the composer. */
  const onInput = useCallback(
    (inputType: string, draft: ComposerDraft, caret: number) => {
      if (!source || isPassiveInput(inputType)) {
        close();
        return;
      }
      // Any keystroke re-reads the `@word`: typing brings back a list hidden
      // with Escape, as in Element.
      const next = findMentionTrigger(draft.text, caret, draft.mentions);
      if (!next) {
        close();
        return;
      }
      setIsWanted(true);
      setTrigger(next);
    },
    [close, source],
  );

  /** Closes the list when the caret leaves the `@` being typed. */
  const onSelectionChange = useCallback(() => {
    const input = inputRef.current;
    if (!trigger || !input) {
      return;
    }
    const { text, mentions } = draftRef.current;
    const next = findMentionTrigger(text, input.selectionEnd, mentions);
    if (next?.start !== trigger.start) {
      close();
    } else if (next.query !== trigger.query) {
      setTrigger(next);
    }
  }, [close, draftRef, inputRef, trigger]);

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

  /** Handles the list's keys while it is open. Returns true when handled. */
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!isOpen || event.altKey || event.ctrlKey || event.metaKey) {
        return false;
      }
      const move = (step: number) => {
        const next = (selectedIndex + step + items.length) % items.length;
        setSelectedId(items[next].id);
      };
      if (event.key === "ArrowDown") {
        move(1);
      } else if (event.key === "ArrowUp") {
        move(-1);
      } else if (
        (event.key === "Enter" || event.key === "Tab") &&
        !event.shiftKey
      ) {
        confirm(items[selectedIndex]);
      } else if (event.key === "Escape") {
        close();
        // Escape here only hides the list, not an edit in progress.
        event.stopPropagation();
      } else {
        return false;
      }
      event.preventDefault();
      return true;
    },
    [close, confirm, isOpen, items, selectedIndex],
  );

  return {
    isOpen,
    listId,
    items,
    selectedIndex,
    activeOptionId:
      isOpen && items[selectedIndex]
        ? optionId(items[selectedIndex])
        : undefined,
    optionId,
    onInput,
    onSelectionChange,
    onBlur: close,
    onKeyDown,
    confirm,
  };
};
