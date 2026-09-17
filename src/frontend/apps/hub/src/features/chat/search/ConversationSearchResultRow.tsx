import {
  QuickSearchItem,
  QuickSearchItemTemplate,
} from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

import type { Chat } from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

import { renderChatAvatarContent } from "./chatAvatarContent";

type ConversationSearchResultRowProps = {
  id: string;
  chat: Chat;
  subtitle: string;
  accountLabel?: string;
  onSelect: () => void;
};

export const ConversationSearchResultRow = ({
  id,
  chat,
  subtitle,
  accountLabel,
  onSelect,
}: ConversationSearchResultRowProps) => {
  const { t } = useTranslation();
  const description = [subtitle, accountLabel].filter(Boolean).join(" · ");

  return (
    <QuickSearchItem id={id} onSelect={onSelect}>
      <QuickSearchItemTemplate
        alwaysShowRight
        left={
          <>
            <Avatar
              label={chat.name}
              decorative
              variant={chat.visual.kind === "emoji" ? "soft" : "solid"}
            >
              {renderChatAvatarContent(chat.visual)}
            </Avatar>
            <span className="hub__conversation-search__text">
              <span className="hub__conversation-search__name">
                {chat.name}
              </span>
              {description && (
                <span className="hub__conversation-search__subtitle">
                  {description}
                </span>
              )}
            </span>
          </>
        }
        right={
          <span className="hub__conversation-search__open">
            {t("Open")}
            <span className="material-icons" aria-hidden="true">
              arrow_forward
            </span>
          </span>
        }
      />
    </QuickSearchItem>
  );
};
