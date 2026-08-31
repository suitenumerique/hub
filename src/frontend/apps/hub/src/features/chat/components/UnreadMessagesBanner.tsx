import { ArrowUp, CircleCheck } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import type { MainTimelineUnreadNavigation } from "./ChatVirtualList";

type UnreadMessagesBannerProps = {
  navigation: MainTimelineUnreadNavigation;
};

/** Main-timeline unread controls from Figma node 2785:13300. */
export const UnreadMessagesBanner = ({
  navigation,
}: UnreadMessagesBannerProps) => {
  const { t } = useTranslation();
  const { count, status, isOpening, isMarkingRead, open, markRead } =
    navigation;
  const label = isOpening
    ? t("Looking for the first unread message…")
    : status === "unavailable"
      ? t("Unread messages are above")
      : count === 1
        ? t("1 unread message")
        : count
          ? t("{{count}} unread messages", { count })
          : t("Unread messages");

  return (
    <div className="hub__unread-banner hub__unread-messages-banner">
      <button
        type="button"
        className="hub__unread-banner__open"
        aria-busy={isOpening || undefined}
        disabled={isOpening || isMarkingRead}
        onClick={open}
      >
        <span className="hub__unread-banner__icon" aria-hidden="true">
          <ArrowUp />
        </span>
        {label}
      </button>
      <button
        type="button"
        className="hub__unread-banner__mark"
        aria-busy={isMarkingRead || undefined}
        disabled={isOpening || isMarkingRead}
        onClick={markRead}
      >
        <span className="hub__unread-banner__icon" aria-hidden="true">
          <CircleCheck />
        </span>
        {t("Mark as read")}
      </button>
    </div>
  );
};
