import { Button } from "@gouvfr-lasuite/ui-components";
import {
  DropdownMenu,
  type DropdownMenuItem,
  useDropdownMenu,
} from "@gouvfr-lasuite/ui-components";
import {
  ArrowDropDown,
  Bell,
  Edit,
  File,
  Leave,
  Meet,
  Shared,
  Star,
  StarSlash,
  Thread,
} from "@gouvfr-lasuite/ui-components/icons";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { isInvitationChat } from "@/features/chat/chatMembership";
import type { ChatTool } from "@/features/chat/components/tools-panel/ChatToolsPanel";
import { useChatFavourite } from "@/features/chat/hooks/useChatFavourite";
import { useRemoveChatFromHistory } from "@/features/chat/hooks/useRemoveChatFromHistory";
import type { Chat } from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

import { ChatMembersModal } from "./ChatMembersModal";
import { LeaveConversationModal } from "./LeaveConversationModal";

type ChatHeaderProps = {
  /** `null` while the conversation is being fetched — renders a skeleton. */
  chat: Chat | null;
  activeTool: ChatTool | null;
  onToggleTool: (tool: ChatTool) => void;
  /**
   * Whether to render the conversation tools (meeting, threads, files). Off for
   * a pending invitation, whose tools panel and composer are suppressed.
   */
  showTools?: boolean;
};

/**
 * Top bar of a conversation. Renders even when `chat` is still loading so the
 * chat tools stay mounted across navigations between conversations — only the
 * breadcrumb swaps to a skeleton while the chat is being fetched.
 */
export const ChatHeader = ({
  chat,
  activeTool,
  onToggleTool,
  showTools = true,
}: ChatHeaderProps) => {
  const { t } = useTranslation();

  return (
    <header className="hub__chat-header" aria-label={t("Chat header")}>
      {chat ? (
        <ChatMenu chat={chat} />
      ) : (
        <div
          className="hub__chat-header__breadcrumb hub__chat-header__breadcrumb--skeleton"
          role="status"
          aria-busy="true"
          aria-label={t("Loading conversation…")}
        >
          <span
            className="hub__chat-header__breadcrumb__avatar-skeleton"
            aria-hidden="true"
          />
          <span
            className="hub__chat-header__breadcrumb__name-skeleton"
            aria-hidden="true"
          />
        </div>
      )}

      <div className="hub__chat-header__actions">
        {showTools && (
          <div className="hub__chat-header__selector">
            <Button
              type="button"
              variant="tertiary"
              color="neutral"
              size="small"
              className="hub__chat-header__icon-button"
              aria-label={t("Start a meeting")}
              icon={<Meet />}
            />
            <span className="hub__chat-header__separator" aria-hidden="true" />
            <Button
              type="button"
              variant="tertiary"
              color="neutral"
              size="small"
              className="hub__chat-header__icon-button"
              aria-label={t("Threads")}
              aria-pressed={activeTool === "threads"}
              data-active={activeTool === "threads"}
              active={activeTool === "threads"}
              onClick={() => onToggleTool("threads")}
              icon={<Thread />}
            />
            <Button
              type="button"
              variant="tertiary"
              color="neutral"
              size="small"
              className="hub__chat-header__icon-button"
              aria-label={t("Files")}
              aria-pressed={activeTool === "files"}
              data-active={activeTool === "files"}
              active={activeTool === "files"}
              onClick={() => onToggleTool("files")}
              icon={<File />}
            />
          </div>
        )}
      </div>
    </header>
  );
};

const ChatMenu = ({ chat }: { chat: Chat }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const menu = useDropdownMenu();
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const { setFavourite, isPending } = useChatFavourite(chat.ref);
  const {
    removeFromHistory,
    isPending: isLeaving,
    isSupported: canLeave,
  } = useRemoveChatFromHistory(chat.ref);
  const isFavourite = chat.section === "favourites";
  const isInvitation = isInvitationChat(chat);

  useEffect(() => {
    menu.setIsOpen(false);
    setIsMembersOpen(false);
    setIsLeaveOpen(false);
  }, [chat.ref.accountId, chat.ref.chatId, menu.setIsOpen]);

  const leaveConversation = useCallback(() => {
    if (isLeaving) {
      return;
    }
    void removeFromHistory()
      .then(() => {
        setIsLeaveOpen(false);
        void router.replace("/chat/new");
      })
      .catch(() => {
        // The hook surfaces the error; keep the modal open for another attempt.
      });
  }, [isLeaving, removeFromHistory, router]);

  const options = useMemo<DropdownMenuItem[]>(
    () => [
      {
        id: "members",
        label: t("Members"),
        icon: <Shared />,
        callback: () => setIsMembersOpen(true),
      },
      {
        id: "favourite",
        label: isFavourite
          ? t("Remove from favourites")
          : t("Add to favourites"),
        icon: isFavourite ? <StarSlash /> : <Star />,
        isDisabled: isPending,
        callback: () => setFavourite(!isFavourite),
      },
      { type: "separator" },
      {
        id: "rename",
        label: t("Rename conversation"),
        icon: <Edit />,
        isDisabled: true,
      },
      {
        id: "notifications",
        label: t("Notifications"),
        icon: <Bell />,
        isDisabled: true,
      },
      {
        id: "leave",
        label: t("Leave conversation"),
        icon: <Leave />,
        variant: "danger",
        isDisabled: !canLeave || isLeaving,
        callback: () => setIsLeaveOpen(true),
      },
    ],
    [canLeave, isFavourite, isLeaving, isPending, setFavourite, t],
  );

  const trigger = (
    <Button
      type="button"
      variant="tertiary"
      color="neutral"
      size="small"
      className="hub__chat-header__breadcrumb"
      disabled={isInvitation}
      aria-label={chat.name}
      aria-haspopup={isInvitation ? undefined : "menu"}
      aria-expanded={isInvitation ? undefined : menu.isOpen}
      onClick={() => menu.setIsOpen((open) => !open)}
    >
      <ChatAvatar chat={chat} />
      <span className="hub__chat-header__breadcrumb__name">{chat.name}</span>
      {!isInvitation && <ArrowDropDown aria-hidden="true" />}
    </Button>
  );

  if (isInvitation) {
    return trigger;
  }

  return (
    <>
      <DropdownMenu options={options} {...menu} onOpenChange={menu.setIsOpen}>
        {trigger}
      </DropdownMenu>
      <ChatMembersModal
        chat={chat}
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
      />
      <LeaveConversationModal
        isOpen={isLeaveOpen}
        isPending={isLeaving}
        onClose={() => setIsLeaveOpen(false)}
        onConfirm={leaveConversation}
      />
    </>
  );
};

const ChatAvatar = ({ chat }: { chat: Chat }) => {
  if (chat.visual.kind === "emoji") {
    return (
      <Avatar label={chat.name} variant="soft" decorative>
        {chat.visual.emoji}
      </Avatar>
    );
  }
  if (chat.visual.kind === "icon") {
    return (
      <Avatar label={chat.name} decorative>
        <span className="material-icons" aria-hidden="true">
          {chat.visual.icon}
        </span>
      </Avatar>
    );
  }
  return <Avatar label={chat.name} decorative />;
};
