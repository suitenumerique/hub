import {
  QuickSearchItem,
  QuickSearchItemTemplate,
} from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

import type { Chat, ChatVisual } from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

type ConversationSearchResultRowProps = {
  id: string;
  chat: Chat;
  subtitle: string;
  accountLabel?: string;
  onSelect: () => void;
};

const renderAvatarContent = (visual: ChatVisual) => {
  switch (visual.kind) {
    case "emoji":
      return visual.emoji;
    case "icon":
      return (
        <span className="material-icons" aria-hidden="true">
          {visual.icon}
        </span>
      );
    default:
      return null;
  }
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
              {renderAvatarContent(chat.visual)}
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
