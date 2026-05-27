import { ArrowLeft, XMark } from "@gouvfr-lasuite/ui-kit/icons";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type ToolsPanelHeaderProps = {
  title: string;
  /** Whether the panel is open — drives the controls' tab order. */
  isOpen: boolean;
  onClose: () => void;
  /** When set, renders a leading back button (e.g. thread detail → list). */
  onBack?: () => void;
  /** Optional control rendered between the title and the close button. */
  action?: ReactNode;
};

/**
 * Shared header for the chat tools panel: a title, an optional back button and
 * an optional action slot, plus the close button. Reused by the documents tool
 * and both threads views.
 */
export const ToolsPanelHeader = ({
  title,
  isOpen,
  onClose,
  onBack,
  action,
}: ToolsPanelHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="hub__chat-tools-panel__header">
      {onBack && (
        <button
          type="button"
          className="hub__chat-tools-panel__header-button"
          onClick={onBack}
          aria-label={t("Back to all threads")}
          tabIndex={isOpen ? 0 : -1}
        >
          <ArrowLeft />
        </button>
      )}
      <h2 className="hub__chat-tools-panel__title">{title}</h2>
      {action}
      <button
        type="button"
        className="hub__chat-tools-panel__header-button"
        onClick={onClose}
        aria-label={t("Close panel")}
        tabIndex={isOpen ? 0 : -1}
      >
        <XMark />
      </button>
    </div>
  );
};
