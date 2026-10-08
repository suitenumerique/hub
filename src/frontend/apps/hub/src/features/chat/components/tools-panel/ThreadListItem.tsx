import {
  ArrowCornerDownRight,
  ChevronRight,
} from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import type { AccountId, ChatThread } from "@/features/drivers/types";

import { formatChatTime } from "../../formatTimestamp";
import { isOptimisticThreadId } from "../../hooks/chatCompositionCache";
import { ChatUserAvatar } from "../ChatUserAvatar";

type ThreadListItemProps = {
  accountId: AccountId;
  thread: ChatThread;
  onOpen: () => void;
};

/**
 * One row of the threads panel list (Figma "List Thread"). Read and unread are
 * the same markup — the `data-unread` flag drives the bold author, the brand
 * reply count and the leading dot through CSS.
 */
export const ThreadListItem = ({
  accountId,
  thread,
  onOpen,
}: ThreadListItemProps) => {
  const { t } = useTranslation();
  const isUnread = thread.unreadCount > 0;
  const isPending = isOptimisticThreadId(thread.id);

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
        disabled={isPending}
        aria-busy={isPending || undefined}
      >
        <span className="hub__chat-thread-item__indicator" aria-hidden="true" />
        <ChatUserAvatar accountId={accountId} user={thread.author} />
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
