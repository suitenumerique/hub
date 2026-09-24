import { Lock } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import type { ChatRef } from "@/features/drivers/types";

import { useChat } from "../hooks/useChat";

/** Lives in the timeline header, only once its earliest page is loaded. */
export const ChatEncryptionNotice = ({ chatRef }: { chatRef: ChatRef }) => {
  const { t } = useTranslation();
  const { chat } = useChat(chatRef);
  if (chat?.encryption !== "encrypted") return null;

  return (
    <div className="hub__encryption-notice">
      <Lock aria-hidden="true" />
      <div>
        <h2>{t("Encryption enabled")}</h2>
        <p>{t("Messages in this conversation are end-to-end encrypted.")}</p>
      </div>
    </div>
  );
};
