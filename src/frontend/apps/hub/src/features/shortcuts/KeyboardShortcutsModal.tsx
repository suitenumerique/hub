import { Modal, ModalSize } from "@gouvfr-lasuite/ui-components";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import type { ShortcutName } from "./keyboardShortcuts";
import { ShortcutKeys } from "./ShortcutKeys";

type ShortcutRow = { name: ShortcutName; label: string };

const ShortcutSection = ({
  title,
  rows,
}: {
  title: string;
  rows: ShortcutRow[];
}) => {
  const titleId = useId();
  return (
    <section className="hub__shortcuts__section" aria-labelledby={titleId}>
      <h3 id={titleId} className="hub__shortcuts__title">
        {title}
      </h3>
      <dl className="hub__shortcuts__list">
        {rows.map(({ name, label }) => (
          <div key={name} className="hub__shortcuts__row">
            <dt className="hub__shortcuts__label">{label}</dt>
            <dd className="hub__shortcuts__keys">
              <ShortcutKeys name={name} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

/** Lists every keyboard shortcut, opened with Ctrl/⌘ + / as in Element. */
export const KeyboardShortcutsModal = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen
      onClose={onClose}
      size={ModalSize.MEDIUM}
      title={t("Keyboard shortcuts")}
      closeOnClickOutside
    >
      <div className="hub__shortcuts">
        <ShortcutSection
          title={t("Navigation")}
          rows={[
            { name: "searchChats", label: t("Search chats") },
            { name: "previousChat", label: t("Previous chat") },
            { name: "nextChat", label: t("Next chat") },
            { name: "previousUnreadChat", label: t("Previous unread chat") },
            { name: "nextUnreadChat", label: t("Next unread chat") },
            {
              name: "toggleToolsPanel",
              label: t("Open or close the side panel"),
            },
            { name: "showShortcuts", label: t("Show keyboard shortcuts") },
          ]}
        />
        <ShortcutSection
          title={t("Message composer")}
          rows={[
            { name: "sendMessage", label: t("Send message") },
            { name: "newLine", label: t("New line") },
            { name: "attachFile", label: t("Attach a file") },
            {
              name: "editPreviousMessage",
              label: t("Edit your last message, from the start of the field"),
            },
            {
              name: "editNextMessage",
              label: t("Edit the next message, while editing"),
            },
            { name: "cancelEdit", label: t("Cancel editing") },
          ]}
        />
        <ShortcutSection
          title={t("Formatting")}
          rows={[
            { name: "bold", label: t("Bold") },
            { name: "italic", label: t("Italic") },
            { name: "code", label: t("Code") },
            { name: "quote", label: t("Quote") },
            { name: "link", label: t("Link") },
          ]}
        />
      </div>
    </Modal>
  );
};
