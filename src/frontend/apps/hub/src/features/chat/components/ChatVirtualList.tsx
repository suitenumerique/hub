import { memo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import type {
  ChatMessage,
  ChatMessageAuthor,
} from "@/features/drivers/types";

import { useChatMessages } from "../hooks/useChatMessages";

import { ChatBubble } from "./ChatBubble";

type ChatVirtualListProps = {
  chatId: string;
};

// Average bubble height. Lets Virtuoso lay out rows without waiting on the
// first measurement pass — eliminates the visible "flash" before the list
// snaps to the bottom on chat open / switch.
const DEFAULT_ITEM_HEIGHT = 72;

export const ChatVirtualList = ({ chatId }: ChatVirtualListProps) => {
  const { t } = useTranslation();
  const {
    messages,
    authorsById,
    hasOlder,
    isFetchingOlder,
    isInitialLoading,
    firstItemIndex,
    fetchOlder,
  } = useChatMessages(chatId);

  // Keep one Virtuoso instance alive across chat switches — remounting it on
  // every chat change costs ~500ms of measurement + layout, which is what
  // made switching feel sluggish.
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const previousChatIdRef = useRef(chatId);
  const pendingScrollRaf = useRef<number | null>(null);

  useEffect(() => {
    if (previousChatIdRef.current === chatId) {
      return;
    }
    previousChatIdRef.current = chatId;
    // Two rAFs: the first lets React commit the new `data` + `firstItemIndex`,
    // the second lets Virtuoso recompute its internal layout before we ask it
    // to scroll to the last row.
    pendingScrollRaf.current = requestAnimationFrame(() => {
      pendingScrollRaf.current = requestAnimationFrame(() => {
        pendingScrollRaf.current = null;
        virtuosoRef.current?.scrollToIndex({
          index: "LAST",
          align: "end",
          behavior: "auto",
        });
      });
    });
    return () => {
      if (pendingScrollRaf.current !== null) {
        cancelAnimationFrame(pendingScrollRaf.current);
        pendingScrollRaf.current = null;
      }
    };
  }, [chatId]);

  if (isInitialLoading) {
    return (
      <div className="hub__chat-conversation__loading" role="status">
        {t("Loading messages…")}
      </div>
    );
  }

  return (
    <div className="hub__chat-conversation__list">
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        firstItemIndex={firstItemIndex}
        computeItemKey={(_index, message) => message.id}
        defaultItemHeight={DEFAULT_ITEM_HEIGHT}
        // Honoured only on the very first mount; subsequent chat switches
        // rely on the imperative scrollToIndex above.
        initialTopMostItemIndex={Math.max(0, messages.length - 1)}
        startReached={hasOlder ? fetchOlder : undefined}
        increaseViewportBy={{ top: 400, bottom: 0 }}
        components={{
          // Always render a spacer the height of the floating ChatHeader so
          // the topmost message is never hidden behind it. The top-loader
          // takes over the spacer's contents while fetching older pages.
          Header: () => (
            <div className="hub__chat-conversation__top-spacer">
              {isFetchingOlder && (
                <div
                  className="hub__chat-conversation__top-loader"
                  role="status"
                >
                  <span className="material-icons" aria-hidden="true">
                    sync
                  </span>
                  {t("Loading older messages…")}
                </div>
              )}
            </div>
          ),
        }}
        itemContent={(virtualIndex, message) => {
          const arrayIndex = virtualIndex - firstItemIndex;
          return (
            <Row
              message={message}
              chatId={chatId}
              prev={messages[arrayIndex - 1]}
              next={messages[arrayIndex + 1]}
              authorsById={authorsById}
            />
          );
        }}
      />
    </div>
  );
};

type RowProps = {
  message: ChatMessage;
  /** Stable for the whole list — does not invalidate the row memo. */
  chatId: string;
  prev: ChatMessage | undefined;
  next: ChatMessage | undefined;
  authorsById: Map<string, ChatMessageAuthor>;
};

const Row = memo(function Row({
  message,
  chatId,
  prev,
  next,
  authorsById,
}: RowProps) {
  const isSent = message.authorId === "me";
  const isFirstOfGroup = !prev || prev.authorId !== message.authorId;
  const isLastOfGroup = !next || next.authorId !== message.authorId;

  if (isSent) {
    return (
      <RowShell>
        <ChatBubble
          variant="sent"
          chatId={chatId}
          messageId={message.id}
          content={message.content}
          timestamp={message.timestamp}
          reactions={message.reactions}
          thread={message.thread}
          showTimestamp={isLastOfGroup}
        />
      </RowShell>
    );
  }

  const author = authorsById.get(message.authorId);
  if (!author) {
    return null;
  }
  return (
    <RowShell>
      <ChatBubble
        variant="received"
        chatId={chatId}
        messageId={message.id}
        content={message.content}
        author={author}
        timestamp={message.timestamp}
        reactions={message.reactions}
        thread={message.thread}
        showHeader={isFirstOfGroup}
        showAvatar={isLastOfGroup}
      />
    </RowShell>
  );
});

const RowShell = ({ children }: { children: React.ReactNode }) => (
  <div className="hub__chat-conversation__row">
    <div className="hub__chat-conversation__row-inner">{children}</div>
  </div>
);
