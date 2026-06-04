import { CircleCheck, Reply } from "@gouvfr-lasuite/ui-kit/icons";
import { useTranslation } from "react-i18next";

import type { ChatRef, ChatThread } from "@/features/drivers/types";

import { useChatPanel } from "../ChatPanelContext";
import { useChatThreadActions } from "../hooks/useChatThreadActions";

type UnreadThreadsBannerProps = {
  chatRef: ChatRef;
  /** Threads with unread replies — guaranteed non-empty by the caller. */
  unreadThreads: ChatThread[];
};

/**
 * The strip shown above the composer when the conversation has unread threads
 * (Figma node 1222:193104). Opening jumps straight to the thread when there is
 * only one unread, otherwise it opens the thread list.
 */
export const UnreadThreadsBanner = ({
  chatRef,
  unreadThreads,
}: UnreadThreadsBannerProps) => {
  const { t } = useTranslation();
  const { openThread, openThreadList } = useChatPanel();
  const { markAllRead } = useChatThreadActions(chatRef);

  const count = unreadThreads.length;

  const handleOpen = () => {
    if (count === 1) {
      openThread(unreadThreads[0].id);
    } else {
      openThreadList();
    }
  };

  return (
    <div className="hub__unread-threads-banner">
      <button
        type="button"
        className="hub__unread-threads-banner__open"
        onClick={handleOpen}
      >
        <span className="hub__unread-threads-banner__icon" aria-hidden="true">
          <Reply />
        </span>
        {count === 1
          ? t("1 unread thread")
          : t("{{count}} unread threads", { count })}
      </button>
      <button
        type="button"
        className="hub__unread-threads-banner__mark"
        onClick={markAllRead}
      >
        <span className="hub__unread-threads-banner__icon" aria-hidden="true">
          <CircleCheck />
        </span>
        {t("Mark all as read")}
      </button>
    </div>
  );
};
