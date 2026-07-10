import { ArrowUp, Edit, XMark } from "@gouvfr-lasuite/ui-kit/icons";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { notify } from "@/features/ui/components/toast";

const TYPING_STOP_WAIT_MS = 400;

type ChatComposerProps = {
  /** Input placeholder. Defaults to the conversation composer wording. */
  placeholder?: string;
  /** Accessible name of the input. Defaults to "Message". */
  inputLabel?: string;
  /**
   * Identifies the conversation the draft belongs to. When it changes from one
   * concrete conversation to another, the draft is cleared so it can never be
   * sent to the wrong one. A transition from `undefined` to a value is NOT a
   * switch — it is the new-chat → resolved-chat handoff — and keeps the draft.
   */
  conversationId?: string;
  disabled?: boolean;
  isSubmitting?: boolean;
  autoFocus?: boolean;
  /**
   * Imperative focus trigger: whenever this number changes (and the input is
   * enabled), the composer takes focus. Lets the New Chat search bar move focus
   * into the composer on Enter without holding a ref to it.
   */
  focusSignal?: number;
  /** Message shown in the error toast on send failure. Defaults to a generic one. */
  errorMessage?: string;
  onSubmit?: (content: string) => Promise<unknown> | unknown;
  /** Message whose current text should be edited by this composer. */
  editDraft?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
  /** Reports real keyboard input for volatile typing notifications. */
  onTypingActivity?: (hasText: boolean) => Promise<unknown> | unknown;
};

export const ChatComposer = ({
  placeholder,
  inputLabel,
  conversationId,
  disabled = false,
  isSubmitting = false,
  autoFocus = false,
  focusSignal,
  errorMessage,
  onSubmit,
  editDraft,
  onCancelEdit,
  onTypingActivity,
}: ChatComposerProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const lastConcreteConversationId = useRef(conversationId);
  const trimmedDraft = useMemo(() => draft.trim(), [draft]);
  const isBusy = isSubmitting || isSubmittingDraft;
  const canSubmit =
    Boolean(onSubmit) && !disabled && !isBusy && trimmedDraft.length > 0;

  // Drop the draft when the conversation identity changes to a DIFFERENT
  // concrete one, so a message typed for conversation A can never be sent to
  // conversation B. Tracks the last concrete id and ignores `undefined`
  // transitions, so the memory survives the new-chat draft state: a
  // `undefined → value` step is the new-chat → resolved-chat handoff and keeps
  // the draft, but `A → undefined → B` (e.g. previewing a DM, then adding a
  // participant and creating a group) still clears it.
  useEffect(() => {
    if (!conversationId) {
      return;
    }
    if (
      lastConcreteConversationId.current &&
      lastConcreteConversationId.current !== conversationId
    ) {
      setDraft("");
    }
    lastConcreteConversationId.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (!editDraft) {
      return;
    }
    setDraft(editDraft.content);
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(
        editDraft.content.length,
        editDraft.content.length,
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [editDraft?.id]);

  useEffect(() => {
    if (!autoFocus || disabled) {
      return;
    }

    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(raf);
  }, [autoFocus, disabled]);

  // Move focus into the input whenever the parent bumps `focusSignal` (e.g. the
  // New Chat search bar on Enter), as long as the composer is enabled.
  useEffect(() => {
    if (!focusSignal || disabled) {
      return;
    }

    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(raf);
  }, [focusSignal, disabled]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!onSubmit || !canSubmit) {
        return;
      }

      setIsSubmittingDraft(true);
      try {
        // Order typing=false before the message request. Apart from preventing
        // stale indicators, this gives the next non-empty change a clean
        // false→true transition without moving focus away from the input.
        const stopTypingPromise = onTypingActivity?.(false);
        if (stopTypingPromise) {
          await Promise.race([
            Promise.resolve(stopTypingPromise),
            new Promise<void>((resolve) =>
              window.setTimeout(resolve, TYPING_STOP_WAIT_MS),
            ),
          ]);
        }
        await onSubmit(trimmedDraft);
        setDraft("");
      } catch {
        // Keep the draft so the user can retry, and surface the failure: the
        // send mutations silence the global error handler (noGlobalError), so
        // without this toast a failed send would vanish with no feedback.
        notify.error(
          errorMessage ??
            t("Your message could not be sent. Please try again."),
        );
      } finally {
        setIsSubmittingDraft(false);
      }
    },
    [canSubmit, errorMessage, onSubmit, onTypingActivity, t, trimmedDraft],
  );

  const cancelEdit = useCallback(() => {
    setDraft("");
    void onTypingActivity?.(false);
    onCancelEdit?.();
  }, [onCancelEdit, onTypingActivity]);

  return (
    <div className="hub__chat-composer-container">
      {editDraft && (
        <div className="hub__chat-composer-edit" role="status">
          <span className="hub__chat-composer-edit__label">
            <Edit size={16} aria-hidden="true" />
            {t("Editing message")}
          </span>
          <button
            type="button"
            className="hub__chat-composer-edit__cancel"
            aria-label={t("Cancel editing")}
            onClick={cancelEdit}
          >
            <XMark size={16} />
          </button>
        </div>
      )}
      <form className="hub__chat-composer" onSubmit={handleSubmit}>
        <div className="hub__chat-composer__field">
          <input
            ref={inputRef}
            type="text"
            className="hub__chat-composer__input"
            placeholder={placeholder ?? t("Your message")}
            aria-label={inputLabel ?? t("Message")}
            value={draft}
            disabled={disabled}
            readOnly={isBusy}
            aria-busy={isBusy || undefined}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setDraft(value);
              void onTypingActivity?.(value.trim().length > 0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && editDraft) {
                event.preventDefault();
                cancelEdit();
              }
            }}
          />
        </div>
        <div className="hub__chat-composer__actions">
          <button
            type="button"
            className="hub__chat-composer__attach"
            disabled={disabled}
          >
            <span className="material-icons" aria-hidden="true">
              attach_file
            </span>
            <span className="hub__chat-composer__attach-label">
              {t("Attach a file")}
            </span>
          </button>
          <button
            type="submit"
            className="hub__chat-composer__send"
            aria-label={editDraft ? t("Save changes") : t("Send message")}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};
