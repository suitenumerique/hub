import { ArrowUp, CircleCheck } from "@gouvfr-lasuite/ui-components/icons";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

export type UnreadMessagesBannerProps = {
  count: number | null;
  canNavigate: boolean;
  isResolving: boolean;
  onNavigate: () => void;
  onMarkAllRead: () => void;
};

const activateWithKeyboard = (
  event: KeyboardEvent<HTMLButtonElement>,
  action: () => void,
) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  event.preventDefault();
  action();
};

export const UnreadMessagesBanner = ({
  count,
  canNavigate,
  isResolving,
  onNavigate,
  onMarkAllRead,
}: UnreadMessagesBannerProps) => {
  const { t } = useTranslation();
  const label =
    count === null
      ? t("Unread messages")
      : t("{{count}} unread messages", { count });

  return (
    <div className="hub__unread-messages-banner" data-testid="unread-banner">
      <button
        type="button"
        className="hub__unread-messages-banner__open"
        disabled={!canNavigate || isResolving}
        aria-busy={isResolving}
        onClick={onNavigate}
        onKeyDown={(event) => activateWithKeyboard(event, onNavigate)}
      >
        <span className="hub__unread-messages-banner__icon" aria-hidden="true">
          <ArrowUp />
        </span>
        {isResolving && !canNavigate
          ? t("Looking for the first unread message…")
          : label}
      </button>
      <button
        type="button"
        className="hub__unread-messages-banner__mark"
        onClick={onMarkAllRead}
        onKeyDown={(event) => activateWithKeyboard(event, onMarkAllRead)}
      >
        <span className="hub__unread-messages-banner__icon" aria-hidden="true">
          <CircleCheck />
        </span>
        {t("Mark as read")}
      </button>
    </div>
  );
};
