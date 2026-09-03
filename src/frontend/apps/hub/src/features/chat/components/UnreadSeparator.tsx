import { useTranslation } from "react-i18next";

export const UnreadSeparator = ({ visible }: { visible: boolean }) => {
  const { t } = useTranslation();

  return (
    <div
      className="hub__unread-separator"
      role="separator"
      aria-label={t("Unread")}
      aria-hidden={!visible}
      data-visible={visible}
      data-testid="unread-separator"
    >
      <span aria-hidden="true" />
      <strong>{t("Unread")}</strong>
      <span aria-hidden="true" />
    </div>
  );
};
