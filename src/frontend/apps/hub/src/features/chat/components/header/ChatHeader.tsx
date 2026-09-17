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
  ImageAdd,
  Leave,
  Shared,
  Star,
  StarSlash,
  Thread,
} from "@gouvfr-lasuite/ui-components/icons";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { isInvitationChat } from "@/features/chat/chatMembership";
import type { ChatTool } from "@/features/chat/components/tools-panel/ChatToolsPanel";
import { useChatFavourite } from "@/features/chat/hooks/useChatFavourite";
import { useRemoveChatFromHistory } from "@/features/chat/hooks/useRemoveChatFromHistory";
import { useSetChatAvatar } from "@/features/chat/hooks/useSetChatAvatar";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { Chat, ChatRef } from "@/features/drivers/types";
import { RoleBadge } from "@/features/roles/RoleBadge";
import { useUserRoles } from "@/features/roles/useRoles";
import { ChatPresenceAvatar } from "@/features/ui/components/presence/ChatPresenceAvatar";

import { ChatMembersModal } from "./ChatMembersModal";
import { LeaveConversationModal } from "./LeaveConversationModal";
import { MeetingButton } from "./MeetingButton";

type ChatHeaderProps = {
  /** `null` while the conversation is being fetched — renders a skeleton. */
  chat: Chat | null;
  /** Known synchronously from the route, ahead of `chat` itself resolving. */
  chatRef: ChatRef | null;
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
  chatRef,
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
            <MeetingButton
              chatRef={chatRef}
              isActive={activeTool === "meetings"}
              onToggle={() => onToggleTool("meetings")}
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
  const counterpartId =
    chat.kind === "direct" ? chat.participantIds[0] : undefined;
  const roles = useUserRoles(counterpartId ? [counterpartId] : []);
  const role = counterpartId ? roles[counterpartId] : "";
  const accessibleName = role
    ? `${chat.name}, ${t("Role: {{role}}", { role })}`
    : chat.name;
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const { setFavourite, isPending } = useChatFavourite(chat.ref);
  const {
    removeFromHistory,
    isPending: isLeaving,
    isSupported: canLeave,
  } = useRemoveChatFromHistory(chat.ref);
  const { setChatAvatar } = useSetChatAvatar(chat.ref);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const entries = useDriverEntries();
  const canChangeAvatar =
    chat.kind !== "direct" &&
    entries.some(
      (entry) =>
        entry.accountId === chat.accountId && entry.driver.supportsAvatarUpload,
    );
  const isFavourite = chat.section === "favourites";
  const isInvitation = isInvitationChat(chat);

  const onAvatarFileChosen = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) {
        setChatAvatar(file);
      }
    },
    [setChatAvatar],
  );

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
      ...(canChangeAvatar
        ? [
            {
              id: "avatar",
              label: t("Change group photo"),
              icon: <ImageAdd />,
              callback: () => avatarInputRef.current?.click(),
            },
          ]
        : []),
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
    [
      canChangeAvatar,
      canLeave,
      isFavourite,
      isLeaving,
      isPending,
      setFavourite,
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
      // An explicit label replaces the button's content for assistive
      // technology, so the role is spoken with the name rather than lost.
      aria-label={accessibleName}
      aria-haspopup={isInvitation ? undefined : "menu"}
      aria-expanded={isInvitation ? undefined : menu.isOpen}
      onClick={() => menu.setIsOpen((open) => !open)}
    >
      <ChatPresenceAvatar chat={chat} />
      <span className="hub__chat-header__breadcrumb__name">{chat.name}</span>
      <RoleBadge role={role ?? ""} />
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
      {canChangeAvatar && (
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hub__visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onAvatarFileChosen}
        />
      )}
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
