import { forwardRef } from "react";
import { useTranslation } from "react-i18next";

/** Shared Figma-aligned boundary between read and unread messages. */
export const UnreadSeparator = forwardRef<HTMLDivElement>(
  function UnreadSeparator(_props, ref) {
    const { t } = useTranslation();
    const label = t("Unread");

    return (
      <div
        ref={ref}
        className="hub__unread-separator"
        role="separator"
        aria-label={label}
        tabIndex={-1}
        data-unread-separator
      >
        <span className="hub__unread-separator__line" aria-hidden="true" />
        <span className="hub__unread-separator__label">{label}</span>
        <span className="hub__unread-separator__line" aria-hidden="true" />
      </div>
    );
  },
);
