import { useTranslation } from "react-i18next";

export const UnreadSeparator = () => {
  const { t } = useTranslation();

  return (
    <div
      className="hub__unread-separator"
      role="separator"
      aria-label={t("Unread")}
      data-testid="unread-separator"
    >
      <span aria-hidden="true" />
      <strong>{t("Unread")}</strong>
      <span aria-hidden="true" />
    </div>
  );
};
