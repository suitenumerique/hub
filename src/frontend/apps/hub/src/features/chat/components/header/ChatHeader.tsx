import {
  ArrowDropDown,
  File,
  Meet,
  Thread,
} from "@gouvfr-lasuite/ui-kit/icons";
import { useTranslation } from "react-i18next";

import type { MockChat } from "@/features/chat/mockChats";
import { AccountSelector } from "@/features/layouts/components/AccountSelector/AccountSelector";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

type ChatHeaderProps = {
  chat: MockChat;
};

export const ChatHeader = ({ chat }: ChatHeaderProps) => {
  const { t } = useTranslation();

  return (
    <header className="hub__chat-header" aria-label={t("Chat header")}>
      <button type="button" className="hub__chat-header__breadcrumb">
        {chat.visual.kind === "emoji" ? (
          <Avatar label={chat.name} variant="soft" decorative>
            {chat.visual.emoji}
          </Avatar>
        ) : chat.visual.kind === "icon" ? (
          <Avatar label={chat.name} decorative>
            <span className="material-icons" aria-hidden="true">
              {chat.visual.icon}
            </span>
          </Avatar>
        ) : (
          <Avatar label={chat.name} decorative />
        )}
        <span className="hub__chat-header__breadcrumb__name">{chat.name}</span>
        <ArrowDropDown />
      </button>

      <div className="hub__chat-header__actions">
        <div className="hub__chat-header__selector">
          <button
            type="button"
            className="hub__chat-header__icon-button"
            aria-label={t("Start a meeting")}
          >
            <Meet />
          </button>
          <span className="hub__chat-header__separator" aria-hidden="true" />
          <button
            type="button"
            className="hub__chat-header__icon-button"
            aria-label={t("Threads")}
          >
            <Thread />
          </button>
          <button
            type="button"
            className="hub__chat-header__icon-button"
            aria-label={t("Files")}
          >
            <File />
          </button>
        </div>

        <AccountSelector />
      </div>
    </header>
  );
};
