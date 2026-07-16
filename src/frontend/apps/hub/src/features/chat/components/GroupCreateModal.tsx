import {
  Button,
  type ButtonElement,
  Input,
  Modal,
  ModalSize,
  Switch,
} from "@gouvfr-lasuite/cunningham-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { HubGroupFormValues } from "../hooks/useCreateHubGroup";

import { EmojiPickerPopover } from "./EmojiPickerPopover";

type GroupCreateModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: HubGroupFormValues) => void;
};

const INITIAL_VALUES: HubGroupFormValues = {
  name: "",
  emoji: "🌲",
  allowExternalGuests: false,
};

export const GroupCreateModal = ({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}: GroupCreateModalProps) => {
  const { t } = useTranslation();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const emojiButtonRef = useRef<ButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setValues(INITIAL_VALUES);
      setEmojiAnchor(null);
    }
  }, [isOpen]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!values.name.trim() || isSubmitting) {
      return;
    }
    onSubmit({ ...values, name: values.name.trim() });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={ModalSize.SMALL}
      title={t("Create a group")}
      subtitle={t(
        "This group will be available across LaSuite apps to share files, docs, and more.",
      )}
      closeOnClickOutside={!isSubmitting}
      closeOnEsc={!isSubmitting}
      preventClose={isSubmitting}
      rightActions={
        <>
          <Button
            type="button"
            variant="secondary"
            color="neutral"
            disabled={isSubmitting}
            onClick={onClose}
          >
            {t("Cancel")}
          </Button>
          <Button
            type="button"
            color="brand"
            disabled={!values.name.trim() || isSubmitting}
            onClick={() => submit()}
          >
            {isSubmitting ? t("Creating…") : t("Create")}
          </Button>
        </>
      }
    >
      <form className="hub__group-modal" onSubmit={submit}>
        <label className="hub__group-modal__field-label" htmlFor="group-name">
          {t("Emoji and name")}
        </label>
        <div className="hub__group-modal__identity-row">
          <Button
            ref={emojiButtonRef}
            type="button"
            variant="secondary"
            color="neutral"
            className="hub__group-modal__emoji-button"
            aria-label={t("Choose group emoji")}
            onClick={() => setEmojiAnchor(emojiButtonRef.current)}
          >
            {values.emoji}
          </Button>
          <Input
            id="group-name"
            compact
            fullWidth
            hideLabel
            label={t("Group name")}
            placeholder={t("Group name")}
            value={values.name}
            maxLength={255}
            autoFocus
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
        </div>

        <div className="hub__group-modal__setting">
          <Switch
            id="group-external-guests"
            checked={values.allowExternalGuests}
            aria-label={t("Allow external guests")}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                allowExternalGuests: event.target.checked,
              }))
            }
          />
          <label htmlFor="group-external-guests">
            <strong>{t("Allow external guests")}</strong>
            <span>
              {t("Guests outside your organization can join this group.")}
            </span>
          </label>
        </div>
      </form>
      {emojiAnchor && (
        <EmojiPickerPopover
          anchor={emojiAnchor}
          onClose={() => setEmojiAnchor(null)}
          onSelect={(emoji) => {
            setValues((current) => ({ ...current, emoji }));
            setEmojiAnchor(null);
          }}
        />
      )}
    </Modal>
  );
};
