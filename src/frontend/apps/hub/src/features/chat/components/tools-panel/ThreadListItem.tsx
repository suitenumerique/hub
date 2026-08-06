import {
  ArrowCornerDownRight,
  ChevronRight,
} from "@gouvfr-lasuite/ui-kit/icons";
import { useTranslation } from "react-i18next";

import { getThreadAttentionUnreadCount } from "@/features/chat/chatNotificationPolicy";
import type { ChatThread } from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

import { formatChatTime } from "../../formatTimestamp";
import { isOptimisticThreadId } from "../../hooks/chatCompositionCache";

type ThreadListItemProps = {
  thread: ChatThread;
  isMuted: boolean;
  onOpen: () => void;
};

/**
 * One row of the threads panel list (Figma "List Thread"). Neutral and attention
 * states share the same markup: `data-unread` drives the emphasized styling.
 */
export const ThreadListItem = ({
  thread,
  isMuted,
  onOpen,
}: ThreadListItemProps) => {
  const { t } = useTranslation();
  const attentionUnreadCount = getThreadAttentionUnreadCount({
    threadMuted: isMuted,
    unreadCount: thread.unreadCount,
    highlightCount: thread.highlightCount,
  });
  const isUnread = attentionUnreadCount > 0;
  const isPending = isOptimisticThreadId(thread.id);

  const replies =
    thread.replyCount <= 1
      ? t("1 reply")
      : t("{{count}} replies", { count: thread.replyCount });
  const repliesLabel = isUnread
    ? `${replies} • ${t("{{count}} unread", { count: attentionUnreadCount })}`
    : replies;

  return (
    <li className="hub__chat-thread-item" data-unread={isUnread || undefined}>
      <button
        type="button"
        className="hub__chat-thread-item__button"
        onClick={onOpen}
        disabled={isPending}
        aria-busy={isPending || undefined}
      >
        <span className="hub__chat-thread-item__indicator" aria-hidden="true" />
        <Avatar
          label={thread.author.name}
          color={thread.author.color}
          decorative
          size="sm"
        >
          {thread.author.initials}
        </Avatar>
        <span className="hub__chat-thread-item__body">
          <span className="hub__chat-thread-item__head">
            <span className="hub__chat-thread-item__author">
              {thread.author.name}
            </span>
            <span className="hub__chat-thread-item__time">
              {formatChatTime(thread.lastReplyAt)}
            </span>
          </span>
          <span className="hub__chat-thread-item__preview">
            {thread.lastReplyDeleted
              ? t("Message deleted")
              : thread.lastReplyPreview}
          </span>
          <span className="hub__chat-thread-item__replies">
            <span
              className="hub__chat-thread-item__replies-icon"
              aria-hidden="true"
            >
              <ArrowCornerDownRight />
            </span>
            {repliesLabel}
          </span>
        </span>
        <span className="hub__chat-thread-item__chevron" aria-hidden="true">
          <ChevronRight />
        </span>
      </button>
    </li>
  );
};
