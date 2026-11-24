import { Button } from "@gouvfr-lasuite/ui-components";
import {
  DropdownMenu,
  type DropdownMenuItem,
  useDropdownMenu,
} from "@gouvfr-lasuite/ui-components";
import {
  ArrowDropDown,
  File,
  Leave,
  Shared,
  Thread,
} from "@gouvfr-lasuite/ui-components/icons";
import { useRouter } from "next/router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { isInvitationChat } from "@/features/chat/chatMembership";
import type { ChatTool } from "@/features/chat/components/tools-panel/ChatToolsPanel";
import { useChatNotificationMenuItem } from "@/features/chat/hooks/useChatNotificationMenuItem";
import { useChatQuickActions } from "@/features/chat/hooks/useChatQuickActions";
import { useChatUnread } from "@/features/chat/hooks/useChatUnread";
import { useRemoveChatFromHistory } from "@/features/chat/hooks/useRemoveChatFromHistory";
import type { Chat } from "@/features/drivers/types";
import { useGroupChatMenu } from "@/features/groups/hooks/useGroupChatMenu";

import { ChatVisualAvatar } from "../ChatVisualAvatar";
import { ChatMembersModal } from "./ChatMembersModal";
import { LeaveConversationModal } from "./LeaveConversationModal";

type ChatHeaderProps = {
  /** `null` while the conversation is being fetched — renders a skeleton. */
  chat: Chat | null;
  activeTool: ChatTool | null;
  onToggleTool: (tool: ChatTool) => void;
  /** The conversation tools to offer: none for a pending invitation. */
  tools: readonly ChatTool[];
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
  tools,
}: ChatHeaderProps) => {
  const { t } = useTranslation();

  return (
    <header className="hub__chat-header" aria-label={t("Chat header")}>
      <div className="hub__chat-header__toolbar">
        {chat ? (
          <ChatMenu chat={chat} />
        ) : (
          <div
            className="hub__chat-header__breadcrumb hub__chat-header__breadcrumb--skeleton"
            role="status"
            aria-busy="true"
            aria-label={t("Loading chat…")}
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
      </div>

      <div className="hub__chat-header__actions">
        {tools.length > 0 && (
          <div className="hub__chat-header__selector">
            {tools.includes("threads") && (
              <ToolButton
                label={t("Threads")}
                icon={<Thread />}
                isActive={activeTool === "threads"}
                onClick={() => onToggleTool("threads")}
              />
            )}
            {tools.includes("files") && (
              <ToolButton
                label={t("Drive")}
                icon={<File />}
                isActive={activeTool === "files"}
                onClick={() => onToggleTool("files")}
              />
            )}
          </div>
        )}
      </div>
    </header>
  );
};

type ToolButtonProps = {
  label: string;
  icon: ReactNode;
  isActive: boolean;
  onClick: () => void;
};

const ToolButton = ({ label, icon, isActive, onClick }: ToolButtonProps) => (
  <Button
    type="button"
    variant="tertiary"
    color="neutral"
    size="small"
    className="hub__chat-header__icon-button"
    aria-label={label}
    aria-pressed={isActive}
    data-active={isActive}
    active={isActive}
    onClick={onClick}
    icon={icon}
  />
);

const ChatMenu = ({ chat }: { chat: Chat }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const menu = useDropdownMenu();
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const unread = useChatUnread()(chat.ref);
  const quickActionsFor = useChatQuickActions(chat, unread);
  const notifications = useChatNotificationMenuItem(chat);
  const {
    removeFromHistory,
    isPending: isLeaving,
    isSupported: canLeave,
  } = useRemoveChatFromHistory(chat.ref);
  const isInvitation = isInvitationChat(chat);
  const groupMenu = useGroupChatMenu(chat);

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
        callback: groupMenu.openMembers ?? (() => setIsMembersOpen(true)),
      },
      ...groupMenu.items,
      ...quickActionsFor("chat_header_menu"),
      { type: "separator" },
      notifications,
      {
        id: "leave",
        label: t("Leave chat"),
        icon: <Leave />,
        variant: "danger",
        isDisabled: !canLeave || isLeaving,
        callback: () => setIsLeaveOpen(true),
      },
    ],
    [
      canLeave,
      groupMenu.items,
      groupMenu.openMembers,
      isLeaving,
      notifications,
      quickActionsFor,
      t,
    ],
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
      <ChatVisualAvatar chat={chat} />
      <span className="hub__chat-header__breadcrumb__name">{chat.name}</span>
      {!isInvitation && <ArrowDropDown aria-hidden="true" />}
    </Button>
  );

  if (isInvitation) {
    return trigger;
  }

  return (
    <>
      {/* The large menu of the kit, with its default icon size. */}
      <DropdownMenu options={options} {...menu} onOpenChange={menu.setIsOpen}>
        {trigger}
      </DropdownMenu>
      <ChatMembersModal
        chat={chat}
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
      />
      {groupMenu.modals}
      <LeaveConversationModal
        isOpen={isLeaveOpen}
        isPending={isLeaving}
        onClose={() => setIsLeaveOpen(false)}
        onConfirm={leaveConversation}
      />
    </>
  );
};
