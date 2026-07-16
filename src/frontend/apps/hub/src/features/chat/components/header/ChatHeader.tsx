import { Button } from "@gouvfr-lasuite/cunningham-react";
import {
  DropdownMenu,
  type DropdownMenuItem,
  useDropdownMenu,
} from "@gouvfr-lasuite/ui-kit";
import {
  ArrowDropDown,
  Bell,
  Edit,
  File,
  Identity,
  Leave,
  Meet,
  Star,
  StarFilled,
  Thread,
} from "@gouvfr-lasuite/ui-kit/icons";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import { isInvitationChat } from "@/features/chat/chatMembership";
import { chatHref } from "@/features/chat/chatRefs";
import { GroupCreateModal } from "@/features/chat/components/GroupCreateModal";
import type { ChatTool } from "@/features/chat/components/tools-panel/ChatToolsPanel";
import { useCreateHubGroup } from "@/features/chat/hooks/useCreateHubGroup";
import { useChatFavourite } from "@/features/chat/hooks/useChatFavourite";
import { useHubGroupCreationSupport } from "@/features/chat/hooks/useHubGroupCreationSupport";
import { useRenameChat } from "@/features/chat/hooks/useRenameChat";
import type { Chat } from "@/features/drivers/types";
import { AccountSelector } from "@/features/layouts/components/AccountSelector/AccountSelector";
import { Avatar } from "@/features/ui/components/avatar/Avatar";
import { notify } from "@/features/ui/components/toast";

import { ChatMembersModal } from "./ChatMembersModal";
import { RenameGroupModal } from "./RenameGroupModal";

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
 * `<AccountSelector>` and chat tools stay mounted across navigations between
 * conversations — only the breadcrumb swaps to a skeleton while the chat is
 * being fetched.
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

        <AccountSelector />
      </div>
    </header>
  );
};

const ChatMenu = ({ chat }: { chat: Chat }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const menu = useDropdownMenu();
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const { setFavourite, isPending } = useChatFavourite(chat.ref);
  const { createGroup, isCreating, reset } = useCreateHubGroup(chat.accountId);
  const supportsHubGroups = useHubGroupCreationSupport(chat.accountId);
  const isFavourite = chat.section === "favourites";
  const isInvitation = isInvitationChat(chat);
  const isHubGroup = chat.kind === "hub_group" && Boolean(chat.hubGroup);
  const { canRename, isChecking, renameChat, isRenaming } = useRenameChat(
    chat.ref,
    isHubGroup,
  );

  useEffect(() => {
    menu.setIsOpen(false);
    setIsMembersOpen(false);
    setIsGroupModalOpen(false);
    setIsRenameModalOpen(false);
  }, [chat.ref.accountId, chat.ref.chatId, menu.setIsOpen]);

  const options = useMemo<DropdownMenuItem[]>(
    () => [
      {
        id: "members",
        label: t("Members"),
        icon: <Identity />,
        callback: () => setIsMembersOpen(true),
      },
      ...(chat.kind === "multi_party" && !isHubGroup && supportsHubGroups
        ? [
            {
              id: "create-group",
              label: t("Create a group"),
              icon: <Identity />,
              callback: () => {
                reset();
                setIsGroupModalOpen(true);
              },
            } satisfies DropdownMenuItem,
          ]
        : []),
      {
        id: "favourite",
        label: isFavourite
          ? t("Remove from favourites")
          : t("Add to favourites"),
        icon: isFavourite ? <StarFilled /> : <Star />,
        isDisabled: isPending,
        callback: () => setFavourite(!isFavourite),
      },
      { type: "separator" },
      {
        id: "rename",
        label: isHubGroup ? t("Rename group") : t("Rename conversation"),
        icon: <Edit />,
        isDisabled: !isHubGroup || isChecking || !canRename || isRenaming,
        callback: isHubGroup ? () => setIsRenameModalOpen(true) : undefined,
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
        isDisabled: true,
      },
    ],
    [
      chat.kind,
      canRename,
      isFavourite,
      isChecking,
      isHubGroup,
      isPending,
      isRenaming,
      reset,
      setFavourite,
      supportsHubGroups,
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
      <GroupCreateModal
        isOpen={isGroupModalOpen}
        isSubmitting={isCreating}
        onClose={() => setIsGroupModalOpen(false)}
        onSubmit={(values) => {
          void createGroup(values, chat.participantIds, chat.id)
            .then(({ ref }) => {
              setIsGroupModalOpen(false);
              void router.replace(chatHref(ref));
            })
            .catch(() => {
              notify.error(
                t("The conversation could not be transformed into a group."),
              );
            });
        }}
      />
      <RenameGroupModal
        initialName={chat.name}
        isOpen={isRenameModalOpen}
        isSubmitting={isRenaming}
        onClose={() => setIsRenameModalOpen(false)}
        onSubmit={(name) => {
          void renameChat(name)
            .then(() => setIsRenameModalOpen(false))
            .catch(() => {
              notify.error(t("The group could not be renamed."));
            });
        }}
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
