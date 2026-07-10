import { ArrowCornerDownRight } from "@gouvfr-lasuite/ui-kit/icons";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

import type { ChatThreadSummary } from "@/features/drivers/types";

import { isOptimisticThreadId } from "../hooks/chatCompositionCache";

type ThreadButtonProps = {
  summary: ChatThreadSummary;
  /** Opens the thread's detail view in the tools panel. */
  onOpen: () => void;
};

/**
 * The thread affordance shown under a message bubble that opened a thread
 * (Figma "Thread Button"). The unread variant is brand-tinted and appends the
 * unread count; clicking it opens the thread in the tools panel.
 */
export const ThreadButton = ({ summary, onOpen }: ThreadButtonProps) => {
  const { t } = useTranslation();
  const isUnread = summary.unreadCount > 0;
  const isPending = isOptimisticThreadId(summary.id);

  const replies =
    summary.replyCount <= 1
      ? t("1 reply")
      : t("{{count}} replies", { count: summary.replyCount });
  const label = isUnread
    ? `${replies} • ${t("{{count}} unread", { count: summary.unreadCount })}`
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
