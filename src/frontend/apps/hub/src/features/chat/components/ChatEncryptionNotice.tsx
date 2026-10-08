import { Lock, Unlock } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import type { ChatRef } from "@/features/drivers/types";

import { useChat } from "../hooks/useChat";

/** Lives in the timeline header, only once its earliest page is loaded. */
export const ChatEncryptionNotice = ({ chatRef }: { chatRef: ChatRef }) => {
  const { t } = useTranslation();
  const { chat } = useChat(chatRef);

  if (chat?.encryption === "encrypted") {
    return (
      <div className="hub__encryption-notice">
        <Lock aria-hidden="true" />
        <div>
          <h2>{t("Encryption enabled")}</h2>
          <p>{t("Messages in this conversation are end-to-end encrypted.")}</p>
        </div>
      </div>
    );
  }

  // An unresolved state ("unknown") does not prove the room is plaintext.
  if (chat?.encryption === "plaintext") {
    return (
      <div className="hub__encryption-notice">
        <Unlock aria-hidden="true" />
        <div>
          <h2>{t("Encryption not enabled")}</h2>
          <p>
            {t("Messages in this conversation are not end-to-end encrypted.")}
          </p>
        </div>
      </div>
    );
  }

  return null;
};
