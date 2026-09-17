import { useTranslation } from "react-i18next";

import type { ChatUserPresenceState } from "@/features/drivers/types";

type UserPresenceIndicatorProps = {
  state: ChatUserPresenceState | null;
  decorative?: boolean;
  placement?: "inline" | "avatar";
};

const LABELS: Record<ChatUserPresenceState, string> = {
  online: "Online",
  unavailable: "Offline",
  offline: "Offline",
};

/** Pure presentation for a resolved transport-level user presence. */
export const UserPresenceIndicator = ({
  state,
  decorative = false,
  placement = "inline",
}: UserPresenceIndicatorProps) => {
  const { t } = useTranslation();

  if (!state) return null;

  const label = t(LABELS[state]);
  const presentation = state === "online" ? "online" : "offline";
  return (
    <span
      className={`hub__user-presence hub__user-presence--${presentation} hub__user-presence--${placement}`}
      data-presence={state}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      title={label}
    />
  );
};
