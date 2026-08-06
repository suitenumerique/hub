import { ArrowCornerDownRight } from "@gouvfr-lasuite/ui-kit/icons";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

import { getThreadAttentionUnreadCount } from "@/features/chat/chatNotificationPolicy";
import {
  isChatThreadMuted,
  useChatNotificationPreferences,
} from "@/features/chat/hooks/useChatNotificationPreferences";
import type { ChatRef, ChatThreadSummary } from "@/features/drivers/types";

import { isOptimisticThreadId } from "../hooks/chatCompositionCache";

type ThreadButtonProps = {
  chatRef: ChatRef;
  summary: ChatThreadSummary;
  /** Opens the thread's detail view in the tools panel. */
  onOpen: () => void;
};

/**
 * The thread affordance shown under a message bubble that opened a thread
 * (Figma "Thread Button"). The attention variant is brand-tinted and appends
 * surfaced unread replies; a muted thread surfaces mentions only.
 */
export const ThreadButton = ({
  chatRef,
  summary,
  onOpen,
}: ThreadButtonProps) => {
  const { t } = useTranslation();
  const getNotificationPreferences = useChatNotificationPreferences();
  const notificationPreferences = getNotificationPreferences(chatRef);
  const threadMuted = isChatThreadMuted(notificationPreferences, summary.id);
  const attentionUnreadCount = getThreadAttentionUnreadCount({
    threadMuted,
    unreadCount: summary.unreadCount,
    highlightCount: summary.highlightCount,
  });
  const isUnread = attentionUnreadCount > 0;
  const isPending = isOptimisticThreadId(summary.id);

  const replies =
    summary.replyCount <= 1
      ? t("1 reply")
      : t("{{count}} replies", { count: summary.replyCount });
  const label = isUnread
    ? `${replies} • ${t("{{count}} unread", { count: attentionUnreadCount })}`
    : replies;

  return (
    <button
      type="button"
      className={clsx("hub__chat-thread-button", {
        "hub__chat-thread-button--unread": isUnread,
      })}
      onClick={onOpen}
      disabled={isPending}
      aria-busy={isPending || undefined}
    >
      <span className="hub__chat-thread-button__icon" aria-hidden="true">
        <ArrowCornerDownRight />
      </span>
      <span className="hub__chat-thread-button__label">{label}</span>
    </button>
  );
};
