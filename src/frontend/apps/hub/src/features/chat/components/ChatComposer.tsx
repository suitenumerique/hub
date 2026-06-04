import { ArrowUp } from "@gouvfr-lasuite/ui-kit/icons";
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
  /** Message shown in the error toast on send failure. Defaults to a generic one. */
  errorMessage?: string;
  onSubmit?: (content: string) => Promise<unknown> | unknown;
};

export const ChatComposer = ({
  placeholder,
  inputLabel,
  conversationId,
  disabled = false,
  isSubmitting = false,
  autoFocus = false,
  errorMessage,
  onSubmit,
}: ChatComposerProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const previousConversationId = useRef(conversationId);
  const trimmedDraft = useMemo(() => draft.trim(), [draft]);
  const isBusy = isSubmitting || isSubmittingDraft;
  const canSubmit =
    Boolean(onSubmit) && !disabled && !isBusy && trimmedDraft.length > 0;

  // Drop the draft only when switching between two concrete conversations, so a
  // message typed for conversation A can never be sent to conversation B. The
  // `undefined → value` transition is the new-chat handoff and keeps the draft.
  useEffect(() => {
    if (
      previousConversationId.current &&
      conversationId &&
      previousConversationId.current !== conversationId
    ) {
      setDraft("");
    }
    previousConversationId.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (!autoFocus || disabled) {
      return;
    }

    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(raf);
  }, [autoFocus, disabled]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!onSubmit || !canSubmit) {
        return;
      }

      setIsSubmittingDraft(true);
      try {
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
    [canSubmit, errorMessage, onSubmit, t, trimmedDraft],
  );

  return (
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
          onChange={(event) => setDraft(event.currentTarget.value)}
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
          aria-label={t("Send message")}
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </form>
  );
};
