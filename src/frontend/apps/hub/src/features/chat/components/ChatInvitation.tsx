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
    <section className="hub__chat-invitation" aria-label={t("Invitation")}>
      <div className="hub__chat-invitation__illustration" aria-hidden>
        <span className="material-icons hub__chat-invitation__envelope">
          mail
        </span>
        <span className="hub__chat-invitation__badge">
          <span className="material-icons">check</span>
        </span>
      </div>
      <h1 className="hub__chat-invitation__title">{t("New invitation")}</h1>
      <p className="hub__chat-invitation__text">
        {t("{{name}} wants to chat with you. Do you accept the invitation?", {
          name: inviter,
        })}
      </p>
      <div className="hub__chat-invitation__actions">
        <button
          type="button"
          className="hub__chat-invitation__button hub__chat-invitation__button--accept"
          onClick={onAccept}
          disabled={isBusy}
        >
          {isAccepting ? t("Accepting…") : t("Accept")}
        </button>
        <button
          type="button"
          className="hub__chat-invitation__button hub__chat-invitation__button--dismiss"
          onClick={onRefuse}
          disabled={isBusy}
        >
          {isRefusing ? t("Dismissing…") : t("Dismiss")}
        </button>
      </div>
    </section>
  );
};
