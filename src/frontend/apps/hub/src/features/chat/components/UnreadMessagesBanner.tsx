import { ArrowUp, CircleCheck } from "@gouvfr-lasuite/ui-components/icons";
import { type KeyboardEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const EXIT_TRANSITION_MS = 180;

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

export const UnreadMessagesBannerTransition = ({
  banner,
}: {
  banner: UnreadMessagesBannerProps | null;
}) => {
  const [retainedBanner, setRetainedBanner] =
    useState<UnreadMessagesBannerProps | null>(banner);

  // Retain the outgoing callbacks only for the exit transition. The absolute
  // floating stack keeps this extra lifetime from changing composer height.
  useEffect(() => {
    if (banner) {
      setRetainedBanner(banner);
      return;
    }
    if (!retainedBanner) {
      return;
    }
    const timer = window.setTimeout(
      () => setRetainedBanner(null),
      EXIT_TRANSITION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [banner, retainedBanner]);

  const renderedBanner = banner ?? retainedBanner;
  if (!renderedBanner) {
    return null;
  }

  const isVisible = banner !== null;
  return (
    <div
      className="hub__unread-messages-banner-transition"
      data-visible={isVisible}
      aria-hidden={!isVisible}
      inert={!isVisible}
    >
      <UnreadMessagesBanner {...renderedBanner} />
    </div>
  );
};
