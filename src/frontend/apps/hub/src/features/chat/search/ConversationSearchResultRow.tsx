import {
  QuickSearchItem,
  QuickSearchItemTemplate,
} from "@gouvfr-lasuite/ui-components";
import { ArrowRight } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import { ChatVisualAvatar } from "@/features/chat/components/ChatVisualAvatar";
import type { Chat } from "@/features/drivers/types";

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
            <ChatVisualAvatar chat={chat} />
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
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        }
      />
    </QuickSearchItem>
  );
};
