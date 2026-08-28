import { useTranslation } from "react-i18next";

/** Shared Figma-aligned boundary between read and unread messages. */
export const UnreadSeparator = () => {
  const { t } = useTranslation();
  const label = t("Unread");

  return (
    <div
      className="hub__unread-separator"
      role="separator"
      aria-label={label}
      data-unread-separator
    >
      <span className="hub__unread-separator__line" aria-hidden="true" />
      <span className="hub__unread-separator__label">{label}</span>
      <span className="hub__unread-separator__line" aria-hidden="true" />
    </div>
  );
};
