import { Button, Input, Modal, ModalSize } from "@gouvfr-lasuite/ui-components";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { EmojiPickerPopover } from "@/features/chat/components/EmojiPickerPopover";
import { FluentEmoji } from "@/features/chat/components/FluentEmoji";

export const DEFAULT_GROUP_EMOJI = "🌲";

export type GroupFormValues = {
  name: string;
  emoji: string;
};

type GroupFormModalProps = {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  pendingLabel: string;
  initialValues: GroupFormValues;
  isPending: boolean;
  /** Why the last request failed, shown above the buttons. */
  errorMessage: string | null;
  onSubmit: (values: GroupFormValues) => void;
  onClose: () => void;
};

/**
 * The group's emoji and name (Figma "Create a group", without the switches).
 * The same modal creates a group and edits it: only the texts change.
 */
export const GroupFormModal = (props: GroupFormModalProps) =>
  // Mounted on each opening, so it always starts from `initialValues`.
  props.isOpen ? <GroupFormDialog {...props} /> : null;

const GroupFormDialog = ({
  title,
  submitLabel,
  pendingLabel,
  initialValues,
  isPending,
  errorMessage,
  onSubmit,
  onClose,
}: GroupFormModalProps) => {
  const { t } = useTranslation();
  const formId = useId();
  const labelId = useId();
  const nameErrorId = useId();
  const [name, setName] = useState(initialValues.name);
  const [emoji, setEmoji] = useState(initialValues.emoji);
  const [isNameMissing, setIsNameMissing] = useState(false);
  const [emojiButton, setEmojiButton] = useState<HTMLButtonElement | null>(
    null,
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (!isPending) {
      onClose();
    }
  };

  const closePicker = useCallback(() => setIsPickerOpen(false), []);

  const selectEmoji = useCallback(
    (selected: string) => {
      setEmoji(selected);
      closePicker();
      emojiButton?.focus();
    },
    [closePicker, emojiButton],
  );

  // The picker is portaled out of the modal, but its events still bubble
  // through the modal in React: Escape must close the picker only.
  const keepEscapeInPicker = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closePicker();
      emojiButton?.focus();
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (isPending) {
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setIsNameMissing(true);
      nameInputRef.current?.focus();
      return;
    }
    onSubmit({ name: trimmedName, emoji });
  };

  return (
    <Modal
      isOpen
      size={ModalSize.SMALL}
      title={title}
      subtitle={t(
        "This group will be available across LaSuite apps to share files, docs, and more.",
      )}
      onClose={close}
      closeOnEsc={!isPending}
      preventClose={isPending}
      rightActions={
        <>
          <Button
            type="button"
            variant="bordered"
            color="neutral"
            disabled={isPending}
            onClick={close}
          >
            {t("Cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={isPending}>
            {isPending ? pendingLabel : submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="hub__group-form"
        aria-busy={isPending}
        noValidate
        onSubmit={submit}
      >
        <div
          className="hub__group-form__field"
          role="group"
          aria-labelledby={labelId}
        >
          <span id={labelId} className="hub__group-form__label">
            {t("Emoji and name")}
          </span>
          <div className="hub__group-form__row">
            <Button
              ref={setEmojiButton}
              type="button"
              variant="bordered"
              color="neutral"
              className="hub__group-form__emoji"
              aria-label={t("Group emoji: {{emoji}}", { emoji })}
              aria-haspopup="dialog"
              aria-expanded={isPickerOpen}
              disabled={isPending}
              onClick={() => setIsPickerOpen((open) => !open)}
              icon={<FluentEmoji emoji={emoji} size="md" decorative />}
            />
            <div className="hub__group-form__name-column">
              <Input
                ref={nameInputRef}
                className="hub__group-form__name"
                variant="classic"
                label={t("Group name")}
                hideLabel
                placeholder={t("Group name")}
                value={name}
                maxLength={255}
                required
                autoFocus
                fullWidth
                autoComplete="off"
                disabled={isPending}
                state={isNameMissing ? "error" : "default"}
                // The kit's `text` is not tied to the field: ours is.
                aria-invalid={isNameMissing || undefined}
                aria-describedby={isNameMissing ? nameErrorId : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  setIsNameMissing(false);
                }}
              />
              {isNameMissing && (
                <p id={nameErrorId} className="hub__group-form__error">
                  {t("Enter a name for the group.")}
                </p>
              )}
            </div>
          </div>
        </div>
        {errorMessage && (
          <p className="hub__group-form__error" role="alert">
            {errorMessage}
          </p>
        )}
      </form>
      {isPickerOpen && emojiButton && (
        <span onKeyDown={keepEscapeInPicker}>
          <EmojiPickerPopover
            anchor={emojiButton}
            closeOnScroll={false}
            onSelect={selectEmoji}
            onClose={closePicker}
          />
        </span>
      )}
    </Modal>
  );
};
