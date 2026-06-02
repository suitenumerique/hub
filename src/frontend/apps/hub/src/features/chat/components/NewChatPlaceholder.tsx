import { Plus } from "@gouvfr-lasuite/ui-kit/icons";
import { useTranslation } from "react-i18next";

export const NewChatPlaceholder = () => {
  const { t } = useTranslation();

  return (
    <div className="hub__new-chat-placeholder">
      <div className="hub__new-chat-placeholder__illustration" aria-hidden>
        <span className="hub__new-chat-placeholder__bubble hub__new-chat-placeholder__bubble--left" />
        <span className="hub__new-chat-placeholder__bubble hub__new-chat-placeholder__bubble--right" />
        <span className="hub__new-chat-placeholder__bubble hub__new-chat-placeholder__bubble--bottom" />
        <span className="hub__new-chat-placeholder__plus">
          <Plus size={18} />
        </span>
      </div>
      <h1>{t("New chat")}</h1>
      <p>{t("Add people to get started")}</p>
    </div>
  );
};
