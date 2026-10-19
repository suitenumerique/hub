import {
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  type ComposerDraft,
  type ComposerMention,
  diffAtCaret,
  diffTexts,
  EMPTY_DRAFT,
  expandRangeToMentions,
  mentionAfter,
  mentionAround,
  mentionBefore,
  shiftMentions,
  type TextChange,
  validateMentions,
} from "../composer/composerDraft";

/** Texts seen recently with their mentions, so undo and redo bring pills back. */
const HISTORY_SIZE = 100;

const withMention = (
  mentions: readonly ComposerMention[],
  mention: ComposerMention,
): ComposerMention[] =>
  [...mentions, mention].sort((first, second) => first.start - second.start);

const applyChange = (
  draft: ComposerDraft,
  change: TextChange,
  replacement: string,
): ComposerDraft => ({
  text: `${draft.text.slice(0, change.at)}${replacement}${draft.text.slice(change.at + change.removed)}`,
  mentions: shiftMentions(draft.mentions, change),
});

/**
 * The composer's text and the mentions it holds. Every edit of the textarea
 * moves the mentions after it and drops the ones it cuts into; a mention is
 * deleted as a whole and the caret never rests inside one. Programmatic edits
 * go through `execCommand`, which keeps the browser's undo history.
 */
export const useComposerDraft = (
  inputRef: RefObject<HTMLTextAreaElement | null>,
) => {
  const [draft, setDraftState] = useState<ComposerDraft>(EMPTY_DRAFT);
  // Handlers read the latest draft without waiting for a render.
  const draftRef = useRef(draft);
  const historyRef = useRef(new Map<string, readonly ComposerMention[]>());
  const pendingMentionRef = useRef<ComposerMention | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const isPointerDownRef = useRef(false);

  const setDraft = useCallback((next: SetStateAction<ComposerDraft>) => {
    const value = typeof next === "function" ? next(draftRef.current) : next;
    draftRef.current = value;
    setDraftState(value);
    if (value.mentions.length > 0) {
      const history = historyRef.current;
      history.delete(value.text);
      history.set(value.text, value.mentions);
      if (history.size > HISTORY_SIZE) {
        history.delete(history.keys().next().value as string);
      }
    }
  }, []);

  // Fallback edits set the value directly: put the caret back where it goes.
  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret !== null) {
      pendingCaretRef.current = null;
      inputRef.current?.setSelectionRange(caret, caret);
    }
  }, [draft, inputRef]);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>): ComposerDraft => {
      const input = event.currentTarget;
      const text = input.value;
      const previous = draftRef.current;
      const inputType = (event.nativeEvent as InputEvent).inputType ?? "";
      let mentions: ComposerMention[];
      const remembered = inputType.startsWith("history")
        ? historyRef.current.get(text)
        : undefined;
      if (remembered) {
        mentions = [...remembered];
      } else {
        const change =
          diffAtCaret(previous.text, text, input.selectionEnd ?? text.length) ??
          diffTexts(previous.text, text);
        mentions = shiftMentions(previous.mentions, change);
      }
      const pending = pendingMentionRef.current;
      pendingMentionRef.current = null;
      if (pending) {
        mentions = withMention(mentions, pending);
      }
      const next = { text, mentions: validateMentions(mentions, text) };
      setDraft(next);
      return next;
    },
    [setDraft],
  );

  /** Replaces `start`–`end` with `replacement`, keeping native undo. */
  const replaceRange = useCallback(
    (start: number, end: number, replacement: string) => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.setSelectionRange(start, end);
      const handled = replacement
        ? document.execCommand("insertText", false, replacement)
        : document.execCommand("delete");
      if (handled && draftRef.current.text === input.value) {
        return;
      }
      // No `execCommand`: edit the value ourselves, without undo history.
      const pending = pendingMentionRef.current;
      pendingMentionRef.current = null;
      const next = applyChange(
        draftRef.current,
        { at: start, removed: end - start, added: replacement.length },
        replacement,
      );
      pendingCaretRef.current = start + replacement.length;
      setDraft(
        pending
          ? { ...next, mentions: withMention(next.mentions, pending) }
          : next,
      );
    },
    [inputRef, setDraft],
  );

  /** Writes a mention of `userId` over `start`–`end`, then `suffix`. */
  const insertMention = useCallback(
    (
      start: number,
      end: number,
      { userId, name }: { userId: string; name: string },
      suffix: string,
    ) => {
      pendingMentionRef.current = {
        start,
        end: start + name.length,
        userId,
        name,
      };
      replaceRange(start, end, `${name}${suffix}`);
    },
    [replaceRange],
  );

  /** Deletes mentions whole and steps the caret over them. Returns true when handled. */
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      const { mentions, text } = draftRef.current;
      if (mentions.length === 0) {
        return false;
      }
      const input = event.currentTarget;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const isDeletion = event.key === "Backspace" || event.key === "Delete";
      if (isDeletion && start !== end) {
        // Widen the selection; the browser's own deletion then removes it.
        const range = expandRangeToMentions(mentions, start, end);
        input.setSelectionRange(range.start, range.end);
        return false;
      }
      let target: { start: number; end: number } | undefined;
      if (event.key === "Backspace") {
        target = mentionBefore(mentions, start);
        if (!target && (event.altKey || event.ctrlKey)) {
          // A word deletion over "Name |" takes the whole name.
          const previous = [...mentions]
            .reverse()
            .find(
              (mention) =>
                mention.end <= start && !text.slice(mention.end, start).trim(),
            );
          target = previous && { start: previous.start, end: start };
        }
      } else if (event.key === "Delete") {
        target = mentionAfter(mentions, start);
      }
      if (target) {
        event.preventDefault();
        replaceRange(target.start, target.end, "");
        return true;
      }
      const hasModifier =
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      if (start !== end || hasModifier) {
        return false;
      }
      let jumped: number | undefined;
      if (event.key === "ArrowLeft") {
        jumped = mentionBefore(mentions, start)?.start;
      } else if (event.key === "ArrowRight") {
        jumped = mentionAfter(mentions, start)?.end;
      }
      if (jumped === undefined) {
        return false;
      }
      event.preventDefault();
      input.setSelectionRange(jumped, jumped);
      return true;
    },
    [replaceRange],
  );

  /** Moves a caret placed inside a mention to its nearest edge. */
  const snapCaret = useCallback(() => {
    const input = inputRef.current;
    if (!input || input.selectionStart !== input.selectionEnd) {
      return;
    }
    const caret = input.selectionStart;
    const mention = mentionAround(draftRef.current.mentions, caret);
    if (mention) {
      const edge =
        caret - mention.start < mention.end - caret
          ? mention.start
          : mention.end;
      input.setSelectionRange(edge, edge);
    }
  }, [inputRef]);

  const onSelect = useCallback(() => {
    // Wait for the pointer: snapping mid-drag would break the selection.
    if (!isPointerDownRef.current) {
      snapCaret();
    }
  }, [snapCaret]);

  const onPointerDown = useCallback(() => {
    isPointerDownRef.current = true;
  }, []);

  const onPointerUp = useCallback(() => {
    isPointerDownRef.current = false;
    snapCaret();
  }, [snapCaret]);

  return {
    draft,
    draftRef,
    setDraft,
    onChange,
    onKeyDown,
    onSelect,
    onPointerDown,
    onPointerUp,
    insertMention,
  };
};
