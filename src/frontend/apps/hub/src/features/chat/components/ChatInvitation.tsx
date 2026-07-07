import { Button } from "@gouvfr-lasuite/cunningham-react";
import { useTranslation } from "react-i18next";

import type { Chat } from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

type ChatInvitationProps = {
  /** The invited conversation (`membership === "invite"`). */
  chat: Chat;
  onAccept: () => void;
  onRefuse: () => void;
  isAccepting: boolean;
  isRefusing: boolean;
};

/** Localised long date for the invitation timestamp, or `null` when unparsable. */
const formatInvitedAt = (iso: string | undefined, locale: string): string | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
};

/**
 * Invitation detail view shown in the central chat surface while a conversation
 * is a pending incoming invitation. Quiet and utility-focused (it matches the
 * chat surface, not a hero page): the envelope identity, the room/person name,
 * who invited the user, when, and the reason when present, with Accept/Refuse
 * actions. Purely presentational — the action wiring lives in
 * `ChatInvitationView`.
 */
export const ChatInvitation = ({
  chat,
  onAccept,
  onRefuse,
  isAccepting,
  isRefusing,
}: ChatInvitationProps) => {
  const { t, i18n } = useTranslation();
  const invitation = chat.invitation ?? {};
  const inviter = invitation.inviterName || invitation.inviterId;
  const invitedAt = formatInvitedAt(invitation.invitedAt, i18n.language);
  const isBusy = isAccepting || isRefusing;

  return (
    <section className="hub__chat-invitation" aria-label={t("Invitation")}>
      <div className="hub__chat-invitation__card">
        <Avatar label={chat.name} decorative>
          <span className="material-icons" aria-hidden="true">
            mail
          </span>
        </Avatar>

        <p className="hub__chat-invitation__eyebrow">
          {t("You have been invited")}
        </p>
        <h2 className="hub__chat-invitation__name">{chat.name}</h2>

        <dl className="hub__chat-invitation__details">
          {inviter && (
            <div className="hub__chat-invitation__detail">
              <dt>{t("Invited by")}</dt>
              <dd>{inviter}</dd>
            </div>
          )}
          {invitedAt && (
            <div className="hub__chat-invitation__detail">
              <dt>{t("Invited on")}</dt>
              <dd>{invitedAt}</dd>
            </div>
          )}
          {invitation.reason && (
            <div className="hub__chat-invitation__detail">
              <dt>{t("Reason")}</dt>
              <dd>{invitation.reason}</dd>
            </div>
          )}
        </dl>

        <div className="hub__chat-invitation__actions">
          <Button variant="secondary" onClick={onRefuse} disabled={isBusy}>
            {isRefusing ? t("Refusing…") : t("Refuse")}
          </Button>
          <Button onClick={onAccept} disabled={isBusy}>
            {isAccepting ? t("Accepting…") : t("Accept")}
          </Button>
        </div>
      </div>
    </section>
  );
};
