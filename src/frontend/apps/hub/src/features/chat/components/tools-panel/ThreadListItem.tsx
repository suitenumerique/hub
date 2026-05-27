import { ArrowCornerDownRight, ChevronRight } from "@gouvfr-lasuite/ui-kit/icons";
import { useTranslation } from "react-i18next";

import type { ChatThread } from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

import { formatChatTime } from "../../formatTimestamp";

type ThreadListItemProps = {
  thread: ChatThread;
  onOpen: () => void;
};

/**
 * One row of the threads panel list (Figma "List Thread"). Read and unread are
 * the same markup — the `data-unread` flag drives the bold author, the brand
 * reply count and the leading dot through CSS.
 */
export const ThreadListItem = ({ thread, onOpen }: ThreadListItemProps) => {
  const { t } = useTranslation();
  const isUnread = thread.unreadCount > 0;

  const replies =
    thread.replyCount <= 1
      ? t("1 reply")
      : t("{{count}} replies", { count: thread.replyCount });
  const repliesLabel = isUnread
    ? `${replies} • ${t("{{count}} unread", { count: thread.unreadCount })}`
    : replies;

  return (
    <li className="hub__chat-thread-item" data-unread={isUnread || undefined}>
      <button
        type="button"
        className="hub__chat-thread-item__button"
        onClick={onOpen}
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
            {thread.lastReplyPreview}
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
