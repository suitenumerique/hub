import { useTranslation } from "react-i18next";

export const DocumentsTool = () => {
  const { t } = useTranslation();

  return (
    <div className="hub__chat-tools-panel__content">
      <p className="hub__chat-tools-panel__state" role="status">
        {t("Available soon")}
      </p>
    </div>
  );
};
