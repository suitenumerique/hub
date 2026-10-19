import { useTranslation } from "react-i18next";

import { ChatEmptyIllustration } from "./ChatEmptyIllustration";

export const NewChatPlaceholder = ({
  welcome = false,
}: {
  welcome?: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <div className="hub__new-chat-placeholder">
      <ChatEmptyIllustration />
      <h1>{welcome ? t("Welcome to LaSuite Chat") : t("New chat")}</h1>
      <p>
        {welcome
          ? t("Add people using the top bar to start collaborating")
          : t("Add people to get started")}
      </p>
    </div>
  );
};
