import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { AccountId, ChatTypingUser } from "@/features/drivers/types";
import { hashAvatarColor } from "@/features/ui/components/avatar/palette";

import { ChatUserAvatar } from "./ChatUserAvatar";

type TypingIndicatorProps = {
  accountId: AccountId | null;
  users: ChatTypingUser[];
};

const LEAVE_ANIMATION_MS = 220;
// As Element's typing tile: up to three avatars, else two and "+N".
const AVATAR_LIMIT = 3;

export const TypingIndicator = ({ accountId, users }: TypingIndicatorProps) => {
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

  const avatarUsers =
    displayedUsers.length > AVATAR_LIMIT
      ? displayedUsers.slice(0, AVATAR_LIMIT - 1)
      : displayedUsers;
  const othersCount = displayedUsers.length - avatarUsers.length;

  return (
    <div
      className="hub__typing-indicator"
      data-visible={isVisible || undefined}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {avatarUsers.length > 0 && (
        <span className="hub__typing-indicator__avatars" aria-hidden="true">
          {avatarUsers.map((user) => (
            <ChatUserAvatar
              key={user.id}
              accountId={accountId}
              // The same colour as this person's message bubbles.
              user={{ ...user, color: hashAvatarColor(user.id) }}
              size="xs"
            />
          ))}
          {othersCount > 0 && (
            <span className="hub__typing-indicator__others">
              +{othersCount}
            </span>
          )}
        </span>
      )}
      <span className="hub__typing-indicator__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="hub__typing-indicator__label">{label}</span>
    </div>
  );
};
