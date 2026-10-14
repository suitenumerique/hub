import { Meet } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import type { ChatCall } from "@/features/drivers/types";

import { formatChatTime } from "../formatTimestamp";
import { useCall } from "../hooks/useCall";

const MINUTE_IN_MS = 60 * 1000;

/** Whole minutes a call lasted, or `null` when it did not reach one. */
export const getCallDurationInMinutes = (
  startedAt: string,
  endedAt: string | null,
): number | null => {
  if (!endedAt) {
    return null;
  }
  const minutes = Math.floor(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) /
      MINUTE_IN_MS,
  );
  return minutes >= 1 ? minutes : null;
};

type CallActivityProps = {
  call: ChatCall;
  /** Timestamp of the message announcing the call, used until it is loaded. */
  timestamp: string;
};

/**
 * Timeline entry of a call. The message only says that a call was started: its
 * status comes from the Hub API, so every member sees the same one.
 */
export const CallActivity = ({ call, timestamp }: CallActivityProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { data } = useCall(call.id);

  const startedAt = data?.started_at ?? timestamp;
  const hasEnded = data?.status === "ended";
  const duration = data
    ? getCallDurationInMinutes(data.started_at, data.ended_at)
    : null;

  return (
    <div
      className="hub__call-activity"
      data-status={data?.status ?? "unknown"}
      data-testid="call-activity"
    >
      <span className="hub__call-activity__icon" aria-hidden="true">
        <Meet />
      </span>
      <span className="hub__call-activity__label">
        {hasEnded ? t("Meeting ended") : t("Meeting started")}
      </span>
      <span className="hub__call-activity__time">
        {hasEnded && "• "}
        <time dateTime={startedAt}>{formatChatTime(startedAt, locale)}</time>
        {duration !== null && ` (${t("{{count}} min", { count: duration })})`}
      </span>
      {data?.status === "ongoing" && (
        <a
          className="hub__call-activity__join"
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("Join")}
        </a>
      )}
    </div>
  );
};
