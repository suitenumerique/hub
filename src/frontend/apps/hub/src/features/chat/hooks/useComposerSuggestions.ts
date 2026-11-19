import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useId,
  useState,
} from "react";

import type { ComposerDraft, ComposerMention } from "../composer/composerDraft";

/** A word being typed after `@` or `:`: where its sign stands, the text after it. */
export type SuggestionTrigger = { start: number; query: string };

/** Edits that never start suggestions: pasted, dropped or restored text. */
const isPassiveInput = (inputType: string) =>
  inputType.startsWith("insertFrom") ||
  inputType.startsWith("history") ||
  inputType === "insertReplacementText";

type UseSuggestionTriggerOptions = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  draftRef: RefObject<ComposerDraft>;
  /** The word being typed before the caret. Must keep its identity. */
  findTrigger: (
    text: string,
    caret: number,
    mentions: readonly ComposerMention[],
  ) => SuggestionTrigger | null;
  /** Off, the sign is plain text. */
  enabled?: boolean;
};

/**
 * Follows the word a composer's suggestions are for, and the row selected in
 * them. Any keystroke re-reads it, so typing brings back a list hidden with
 * Escape, as in Element; it is dropped when the caret leaves it. `isWanted`
 * turns true at the first one, for the suggestions to start loading.
 */
export const useSuggestionTrigger = ({
  inputRef,
  draftRef,
  findTrigger,
  enabled = true,
}: UseSuggestionTriggerOptions) => {
  const [trigger, setTrigger] = useState<SuggestionTrigger | null>(null);
  const [isWanted, setIsWanted] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const close = useCallback(() => {
    setTrigger(null);
    setSelectedKey(null);
  }, []);

  /** Follows the text after each edit of the composer. */
  const onInput = useCallback(
    (inputType: string, draft: ComposerDraft, caret: number) => {
      const next =
        enabled && !isPassiveInput(inputType)
          ? findTrigger(draft.text, caret, draft.mentions)
          : null;
      if (!next) {
        close();
        return;
      }
      setIsWanted(true);
      setTrigger(next);
    },
    [close, enabled, findTrigger],
  );

  /** Closes the suggestions when the caret leaves the word they are for. */
  const onSelectionChange = useCallback(() => {
    const input = inputRef.current;
    if (!trigger || !input) {
      return;
    }
    const { text, mentions } = draftRef.current;
    const next = findTrigger(text, input.selectionEnd, mentions);
    if (next?.start !== trigger.start) {
      close();
    } else if (next.query !== trigger.query) {
      setTrigger(next);
    }
  }, [close, draftRef, findTrigger, inputRef, trigger]);

  return {
    trigger,
    isWanted,
    selectedKey,
    select: setSelectedKey,
    close,
    onInput,
    onSelectionChange,
  };
};

type UseSuggestionListOptions<Item> = {
  items: readonly Item[];
  /** Tells the rows apart. Must keep its identity. */
  getKey: (item: Item) => string;
  isOpen: boolean;
  selectedKey: string | null;
  select: (key: string) => void;
  onConfirm: (item: Item | undefined) => void;
  onClose: () => void;
};

/**
 * The keys of a composer's suggestions, Element's: arrows move the
 * selection, Enter or Tab confirms it, Escape hides the list until the next
 * keystroke. The textarea keeps the focus and points at the selected row.
 */
export const useSuggestionList = <Item>({
  items,
  getKey,
  isOpen,
  selectedKey,
  select,
  onConfirm,
  onClose,
}: UseSuggestionListOptions<Item>) => {
  const listId = useId();
  // Keep the selected row while the list refines, else the first one.
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => getKey(item) === selectedKey),
  );

  const optionId = useCallback(
    (item: Item) => `${listId}-${getKey(item)}`,
    [getKey, listId],
  );

  /** Handles the list's keys while it is open. Returns true when handled. */
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!isOpen || event.altKey || event.ctrlKey || event.metaKey) {
        return false;
      }
      const move = (step: number) => {
        const next = (selectedIndex + step + items.length) % items.length;
        select(getKey(items[next]));
      };
      if (event.key === "ArrowDown") {
        move(1);
      } else if (event.key === "ArrowUp") {
        move(-1);
      } else if (
        (event.key === "Enter" || event.key === "Tab") &&
        !event.shiftKey
      ) {
        onConfirm(items[selectedIndex]);
      } else if (event.key === "Escape") {
        onClose();
        // Escape here only hides the list, not an edit in progress.
        event.stopPropagation();
      } else {
        return false;
      }
      event.preventDefault();
      return true;
    },
    [getKey, isOpen, items, onClose, onConfirm, select, selectedIndex],
  );

  return {
    listId,
    selectedIndex,
    optionId,
    activeOptionId:
      isOpen && items[selectedIndex]
        ? optionId(items[selectedIndex])
        : undefined,
    onKeyDown,
  };
};
