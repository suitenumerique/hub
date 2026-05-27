import {
  ArrowDropDown,
  File,
  Meet,
  Thread,
} from "@gouvfr-lasuite/ui-kit/icons";
import { useTranslation } from "react-i18next";

import type { ChatTool } from "@/features/chat/components/tools-panel/ChatToolsPanel";
import type { Chat } from "@/features/drivers/types";
import { AccountSelector } from "@/features/layouts/components/AccountSelector/AccountSelector";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

type ChatHeaderProps = {
  /** `null` while the conversation is being fetched — renders a skeleton. */
  chat: Chat | null;
  activeTool: ChatTool | null;
  onToggleTool: (tool: ChatTool) => void;
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
}: ChatHeaderProps) => {
  const { t } = useTranslation();

  return (
    <header className="hub__chat-header" aria-label={t("Chat header")}>
      {chat ? (
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
          <span className="hub__chat-header__breadcrumb__name">
            {chat.name}
          </span>
          <ArrowDropDown />
        </button>
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
            aria-pressed={activeTool === "threads"}
            data-active={activeTool === "threads"}
            onClick={() => onToggleTool("threads")}
          >
            <Thread />
          </button>
          <button
            type="button"
            className="hub__chat-header__icon-button"
            aria-label={t("Files")}
            aria-pressed={activeTool === "files"}
            data-active={activeTool === "files"}
            onClick={() => onToggleTool("files")}
          >
            <File />
          </button>
        </div>

        <AccountSelector />
      </div>
    </header>
  );
};
