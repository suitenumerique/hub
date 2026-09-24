import { Button, Tooltip } from "@gouvfr-lasuite/ui-components";
import {
  ArrowUp,
  AttachFile,
  Edit,
  XMark,
} from "@gouvfr-lasuite/ui-components/icons";
import {
  FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { ChatSecuritySendError } from "@/features/drivers/security";
import type { ChatAttachment } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { MAX_PENDING_ATTACHMENTS } from "../attachments";
import type { UploadChatAttachment } from "../hooks/useChatAttachmentActions";
import { usePendingAttachments } from "../hooks/usePendingAttachments";
import { securityFailureMessage } from "../securityMessages";

import { ComposerAttachments } from "./ComposerAttachments";

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
  /**
   * Posts one uploaded file to the surface's conversation or thread.
   * Providing it shows the attach button.
   */
  onSendAttachment?: (attachment: ChatAttachment) => Promise<unknown>;
  /**
   * Uploads a picked, dropped or pasted file. Omitted while files cannot be
   * stored yet (no conversation, or an account without file support), which
   * disables the attach button.
   */
  onUploadAttachment?: UploadChatAttachment;
  /**
   * Called once everything submitted together (text, then each file) has been
   * posted; never after an edit. Lets a surface defer what would unmount the
   * composer mid-way, such as opening a newly created thread.
   */
  onSubmitted?: () => void;
  /**
   * Area where dropped files are added to this composer, such as the whole
   * conversation or thread. Defaults to the composer itself.
   */
  dropTargetRef?: RefObject<HTMLElement | null>;
};

const hasDraggedFiles = (event: DragEvent) =>
  event.dataTransfer?.types.includes("Files") ?? false;

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
  onSendAttachment,
  onUploadAttachment,
  onSubmitted,
  dropTargetRef,
}: ChatComposerProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const lastConcreteConversationId = useRef(conversationId);
  const handledFocusSignalRef = useRef<number | undefined>(undefined);
  const trimmedDraft = useMemo(() => draft.trim(), [draft]);
  const {
    items: pendingItems,
    addFiles: queueFiles,
    remove: removeAttachment,
    retry: retryAttachment,
    clear: clearAttachments,
    isFull: isAttachmentQueueFull,
    hasRefusedFiles,
  } = usePendingAttachments(onUploadAttachment);
  const isBusy = isSubmitting || isSubmittingDraft;
  // An edit only replaces text: queued files stay aside until it is done.
  const showsAttachments = Boolean(onSendAttachment) && !editDraft;
  const canAttach =
    showsAttachments && Boolean(onUploadAttachment) && !disabled;
  const attachments = showsAttachments ? pendingItems : [];
  const readyAttachments = attachments.flatMap((item) =>
    item.status === "ready" ? [item] : [],
  );
  // Every queued file must be stored first: a failed one is retried or removed
  // rather than silently left out of the message.
  const hasUnstoredAttachments = readyAttachments.length < attachments.length;
  const canSubmit =
    Boolean(onSubmit) &&
    !disabled &&
    !isBusy &&
    !hasUnstoredAttachments &&
    (trimmedDraft.length > 0 || readyAttachments.length > 0);

  const resizeInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    // Reset before measuring so removed text and wider layouts can shrink the
    // field. An empty draft keeps rows={1}: the placeholder can wrap while the
    // tools panel animates from zero width and must not determine its height.
    input.style.height = "auto";
    if (input.value) {
      input.style.height = `${input.scrollHeight}px`;
    }
  }, []);

  useLayoutEffect(() => {
    resizeInput();
  }, [draft, resizeInput]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    let previousWidth: number | undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width === previousWidth) {
        return;
      }
      // Ignore height changes caused by our own measurement.
      previousWidth = entry.contentRect.width;
      resizeInput();
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [resizeInput]);

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
      clearAttachments();
    }
    lastConcreteConversationId.current = conversationId;
  }, [clearAttachments, conversationId]);

  useEffect(() => {
    if (!editDraft) {
      return;
    }
    setDraft(editDraft.content);
    const raf = requestAnimationFrame(() => {
      if (document.querySelector('[role="dialog"]')) return;
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
      // Becoming ready after SAS must not steal focus from its open modal.
      if (document.querySelector('[role="dialog"]')) return;
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(raf);
  }, [autoFocus, disabled]);

  // Move focus into the input whenever the parent bumps `focusSignal` (e.g. the
  // New Chat search bar on Enter), as long as the composer is enabled.
  useEffect(() => {
    if (!focusSignal) {
      handledFocusSignalRef.current = undefined;
      return;
    }
    if (disabled || handledFocusSignalRef.current === focusSignal) {
      return;
    }
    const raf = requestAnimationFrame(() => {
      if (document.querySelector('[role="dialog"]')) return;
      inputRef.current?.focus();
      // Only consume the request after focusing: effect cleanup can cancel the
      // frame before it runs, including during React Strict Mode's first mount.
      handledFocusSignalRef.current = focusSignal;
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
        if (trimmedDraft.length > 0) {
          await onSubmit(trimmedDraft);
          setDraft("");
        }
        // The text goes first, as in a message with files below it. Each file
        // leaves the queue once posted so a failure only keeps the rest.
        if (!editDraft) {
          for (const item of readyAttachments) {
            await onSendAttachment?.(item.attachment);
            removeAttachment(item.id);
          }
          onSubmitted?.();
        }
      } catch (error) {
        // Keep the draft so the user can retry, and surface the failure: the
        // send mutations silence the global error handler (noGlobalError), so
        // without this toast a failed send would vanish with no feedback.
        let message =
          errorMessage ??
          t("Your message could not be sent. Please try again.");
        if (error instanceof ChatSecuritySendError) {
          if (error.reason === "not-ready") {
            message = t(
              "Verify this device and wait for its keys before sending messages.",
            );
          } else if (error.reason === "send-failed") {
            message = t(
              "The encrypted message was rejected or interrupted. Check your connection and device security, then try again. Your draft is saved.",
            );
          } else {
            message = securityFailureMessage(error.reason, t);
          }
        }
        notify.error(message);
      } finally {
        setIsSubmittingDraft(false);
      }
    },
    [
      canSubmit,
      editDraft,
      errorMessage,
      onSendAttachment,
      onSubmit,
      onSubmitted,
      onTypingActivity,
      readyAttachments,
      removeAttachment,
      t,
      trimmedDraft,
    ],
  );

  const addFiles = useCallback(
    (files: FileList | File[] | null | undefined) => {
      if (!canAttach || !files || files.length === 0) {
        return;
      }
      queueFiles(files);
      inputRef.current?.focus();
    },
    [canAttach, queueFiles],
  );

  // Read by the native drop listeners, which are not re-bound on every render.
  const addFilesRef = useRef(addFiles);
  useEffect(() => {
    addFilesRef.current = addFiles;
  }, [addFiles]);

  // Drag events fire again for every child crossed; count the nesting so the
  // drop state only ends once the pointer leaves the target.
  useEffect(() => {
    const target = dropTargetRef?.current ?? containerRef.current;
    if (!canAttach || !target) {
      return;
    }
    let depth = 0;
    const onDragEnter = (event: DragEvent) => {
      if (!hasDraggedFiles(event)) {
        return;
      }
      event.preventDefault();
      depth += 1;
      setIsDraggingFiles(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasDraggedFiles(event) || !event.dataTransfer) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasDraggedFiles(event)) {
        return;
      }
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        setIsDraggingFiles(false);
      }
    };
    const onDrop = (event: DragEvent) => {
      if (!hasDraggedFiles(event)) {
        return;
      }
      event.preventDefault();
      depth = 0;
      setIsDraggingFiles(false);
      addFilesRef.current(event.dataTransfer?.files);
    };
    target.addEventListener("dragenter", onDragEnter);
    target.addEventListener("dragover", onDragOver);
    target.addEventListener("dragleave", onDragLeave);
    target.addEventListener("drop", onDrop);
    return () => {
      target.removeEventListener("dragenter", onDragEnter);
      target.removeEventListener("dragover", onDragOver);
      target.removeEventListener("dragleave", onDragLeave);
      target.removeEventListener("drop", onDrop);
      setIsDraggingFiles(false);
    };
  }, [canAttach, dropTargetRef]);

  const attachLabel = isAttachmentQueueFull
    ? t("{{count}} files maximum per message", {
        count: MAX_PENDING_ATTACHMENTS,
      })
    : t("Attach a file");
  const limitMessage = t("You can attach up to {{count}} files per message.", {
    count: MAX_PENDING_ATTACHMENTS,
  });
  const submitLabel = editDraft ? t("Save changes") : t("Send message");

  const cancelEdit = useCallback(() => {
    setDraft("");
    void onTypingActivity?.(false);
    onCancelEdit?.();
  }, [onCancelEdit, onTypingActivity]);

  return (
    <div className="hub__chat-composer-container" ref={containerRef}>
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
      <form
        className="hub__chat-composer"
        data-has-attachments={attachments.length > 0 || undefined}
        data-dragging={isDraggingFiles || undefined}
        data-full={(isDraggingFiles && isAttachmentQueueFull) || undefined}
        onSubmit={handleSubmit}
      >
        <div className="hub__chat-composer__main">
          <ComposerAttachments
            items={attachments}
            onRemove={removeAttachment}
            onRetry={retryAttachment}
            limitNotice={
              showsAttachments && hasRefusedFiles ? limitMessage : undefined
            }
          />
          <div className="hub__chat-composer__field">
            <textarea
              ref={inputRef}
              rows={1}
              className="hub__chat-composer__input"
              placeholder={placeholder ?? t("Your message")}
              aria-label={inputLabel ?? t("Message")}
              enterKeyHint="send"
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
                  return;
                }
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              onPaste={(event) => {
                // Pasted screenshots arrive as files only; rich text that also
                // carries an image keeps its normal text paste.
                const { files, types } = event.clipboardData;
                if (
                  canAttach &&
                  files.length > 0 &&
                  !types.includes("text/plain")
                ) {
                  event.preventDefault();
                  addFiles(files);
                }
              }}
            />
          </div>
        </div>
        <div className="hub__chat-composer__actions">
          {/* Attaching makes no sense while editing: the button leaves. */}
          {showsAttachments && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                tabIndex={-1}
                onChange={(event) => {
                  addFiles(Array.from(event.currentTarget.files ?? []));
                  // Allows picking the same file again after removing it.
                  event.currentTarget.value = "";
                }}
              />
              <Tooltip
                content={attachLabel}
                placement="top"
                className="hub__delayed-tooltip"
              >
                <Button
                  type="button"
                  size="nano"
                  variant="tertiary"
                  color="neutral"
                  aria-label={attachLabel}
                  icon={<AttachFile size={16} aria-hidden="true" />}
                  disabled={!canAttach || isAttachmentQueueFull}
                  onClick={() => fileInputRef.current?.click()}
                />
              </Tooltip>
            </>
          )}
          <Tooltip
            content={submitLabel}
            placement="top"
            className="hub__delayed-tooltip"
          >
            <Button
              type="submit"
              size="nano"
              variant="primary"
              color="brand"
              aria-label={submitLabel}
              icon={<ArrowUp size={16} aria-hidden="true" />}
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
            />
          </Tooltip>
        </div>
        {isDraggingFiles && (
          // A full queue would refuse the drop: say so before it happens.
          <div className="hub__chat-composer__dropzone" aria-hidden="true">
            {isAttachmentQueueFull ? limitMessage : t("Drop your files here")}
          </div>
        )}
      </form>
    </div>
  );
};
