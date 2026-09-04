import { Button } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

import type { Chat } from "@/features/drivers/types";

type ChatInvitationProps = {
  /** The invited conversation (`membership === "invite"`). */
  chat: Chat;
  onAccept: () => void;
  onRefuse: () => void;
  isAccepting: boolean;
  isRefusing: boolean;
};

/**
 * Invitation detail view shown in the central chat surface while a conversation
 * is a pending incoming invitation. Mirrors the New Chat placeholder's quiet,
 * centered layout — an envelope illustration, a short prompt naming the inviter,
 * and Accept/Dismiss actions. Purely presentational: the action wiring lives in
 * `ChatInvitationView`.
 */
export const ChatInvitation = ({
  chat,
  onAccept,
  onRefuse,
  isAccepting,
  isRefusing,
}: ChatInvitationProps) => {
  const { t } = useTranslation();
  const inviter =
    chat.invitation?.inviterName || chat.invitation?.inviterId || chat.name;
  const isBusy = isAccepting || isRefusing;

  return (
    <section
      className="hub__chat-invitation"
      aria-labelledby="hub-chat-invitation-title"
    >
      <div className="hub__chat-invitation__content">
        <div className="hub__chat-invitation__illustration" aria-hidden>
          <img
            className="hub__chat-invitation__illustration-mail"
            src="/assets/invitation-mail.svg"
            alt=""
          />
          <img
            className="hub__chat-invitation__illustration-status"
            src="/assets/invitation-mail-status.svg"
            alt=""
          />
        </div>
        <h1
          id="hub-chat-invitation-title"
          className="hub__chat-invitation__title"
        >
          {t("New invitation")}
        </h1>
        <p className="hub__chat-invitation__text">
          {t("{{name}} wants to chat with you. Do you accept the invitation?", {
            name: inviter,
          })}
        </p>
      </div>
      <div className="hub__chat-invitation__actions">
        <Button
          type="button"
          variant="secondary"
          color="success"
          size="nano"
          className="hub__chat-invitation__button"
          onClick={onAccept}
          disabled={isBusy}
          aria-busy={isAccepting}
        >
          {t("Accept")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          color="neutral"
          size="nano"
          className="hub__chat-invitation__button"
          onClick={onRefuse}
          disabled={isBusy}
          aria-busy={isRefusing}
        >
          {t("Dismiss")}
        </Button>
      </div>
    </section>
  );
};
