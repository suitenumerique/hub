import {
  QuickSearchItem,
  QuickSearchItemTemplate,
} from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

import type { MessageSearchResult } from "@/features/chat/search/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

import { renderChatAvatarContent } from "./chatAvatarContent";
import { HighlightedExcerpt } from "./highlightExcerpt";

export type MessageSearchResultRowProps = {
  id: string;
  result: MessageSearchResult;
  accountLabel?: string;
  onSelect: () => void;
};

export const MessageSearchResultRow = ({
  id,
  result,
  accountLabel,
  onSelect,
}: MessageSearchResultRowProps) => {
  const { t } = useTranslation();
  const { chat } = result;

  const timestamp = new Date(result.timestamp);
  const timeString = timestamp.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const meta = [result.senderName, accountLabel, timeString]
    .filter(Boolean)
    .join(" · ");

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
              <span className="hub__conversation-search__subtitle">{meta}</span>
              <span className="hub__message-search-row__excerpt">
                <HighlightedExcerpt
                  excerpt={result.excerpt}
                  matchRanges={result.matchRanges}
                />
              </span>
            </span>
          </>
        }
        right={
          <span className="hub__conversation-search__open">
            {t("Jump to message")}
            <span className="material-icons" aria-hidden="true">
              arrow_forward
            </span>
          </span>
        }
      />
    </QuickSearchItem>
  );
};
