import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ChatTypingUser } from "@/features/drivers/types";

type TypingIndicatorProps = {
  users: ChatTypingUser[];
};

const LEAVE_ANIMATION_MS = 220;

export const TypingIndicator = ({ users }: TypingIndicatorProps) => {
  const { t } = useTranslation();
  const [displayedUsers, setDisplayedUsers] = useState(users);
  const leaveTimerRef = useRef<number | null>(null);
  const isVisible = users.length > 0;

  useEffect(() => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (users.length > 0) {
      setDisplayedUsers(users);
      return;
    }
    leaveTimerRef.current = window.setTimeout(() => {
      setDisplayedUsers([]);
      leaveTimerRef.current = null;
    }, LEAVE_ANIMATION_MS);
    return () => {
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
    };
  }, [users]);

  const label = useMemo(() => {
    const names = displayedUsers.map(({ name }) => name);
    if (names.length === 1) {
      return t("{{name}} is typing a message…", { name: names[0] });
    }
    if (names.length === 2) {
      return t("{{first}} and {{second}} are typing a message…", {
        first: names[0],
        second: names[1],
      });
    }
    if (names.length === 3) {
      return t("{{first}}, {{second}} and {{third}} are typing a message…", {
        first: names[0],
        second: names[1],
        third: names[2],
      });
    }
    return names.length > 3 ? t("Several people are typing a message…") : "";
  }, [displayedUsers, t]);

  return (
    <div
      className="hub__typing-indicator"
      data-visible={isVisible || undefined}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="hub__typing-indicator__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="hub__typing-indicator__label">{label}</span>
    </div>
  );
};
