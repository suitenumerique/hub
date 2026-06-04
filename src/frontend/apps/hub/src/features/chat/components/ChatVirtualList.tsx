import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import type {
  ChatRef,
  ChatMessage,
  ChatMessageAuthor,
} from "@/features/drivers/types";

import { useChatMessages } from "../hooks/useChatMessages";

import { ChatBubble } from "./ChatBubble";
import { ChatConversationSkeleton } from "./ChatConversationSkeleton";

type ChatVirtualListProps = {
  chatRef: ChatRef;
};

// Average bubble height. Lets Virtuoso lay out rows without waiting on the
// first measurement pass — eliminates the visible "flash" before the list
// snaps to the bottom on chat open / switch.
const DEFAULT_ITEM_HEIGHT = 72;

// State machine for the skeleton overlay: it stays mounted (and fully
// opaque) while messages are loading, then transitions to `leaving` once
// Virtuoso has had a frame to render — the CSS fade-out runs and the
// transition-end handler flips it to `hidden`, at which point we unmount it.
type SkeletonState = "visible" | "leaving" | "hidden";

export const ChatVirtualList = ({ chatRef }: ChatVirtualListProps) => {
  const { t } = useTranslation();
  const {
    messages,
    authorsById,
    hasOlder,
    isFetchingOlder,
    isInitialLoading,
    firstItemIndex,
    fetchOlder,
  } = useChatMessages(chatRef);

  // Keep one Virtuoso instance alive across chat switches — remounting it on
  // every chat change costs ~500ms of measurement + layout, which is what
  // made switching feel sluggish.
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const previousChatRef = useRef(chatRef);
  const pendingScrollRaf = useRef<number | null>(null);

  const [skeletonState, setSkeletonState] = useState<SkeletonState>(() =>
    isInitialLoading ? "visible" : "hidden",
  );

  useEffect(() => {
    if (isInitialLoading) {
      setSkeletonState("visible");
      return;
    }
    // Wait one frame so Virtuoso has mounted and painted its first batch of
    // bubbles before we start fading the skeleton out — without this delay
    // the skeleton would unmount before Virtuoso lays out, leaving a blank
    // conversation for one or two frames.
    const raf = requestAnimationFrame(() => {
      setSkeletonState((current) =>
        current === "visible" ? "leaving" : current,
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [isInitialLoading]);

  useEffect(() => {
    if (
      previousChatRef.current.accountId === chatRef.accountId &&
      previousChatRef.current.chatId === chatRef.chatId
    ) {
      return;
    }
    previousChatRef.current = chatRef;
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
  }, [chatRef]);

  return (
    <div className="hub__chat-conversation__list">
      {!isInitialLoading && (
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
                chatRef={chatRef}
                prev={messages[arrayIndex - 1]}
                next={messages[arrayIndex + 1]}
                authorsById={authorsById}
              />
            );
          }}
        />
      )}
      {skeletonState !== "hidden" && (
        <ChatConversationSkeleton
          leaving={skeletonState === "leaving"}
          // Guard against a late `transitionend` from a previous leave: if the
          // user re-loaded the chat in the meantime, the state is back to
          // "visible" and we must not flip it to "hidden".
          onLeaveEnd={() =>
            setSkeletonState((current) =>
              current === "leaving" ? "hidden" : current,
            )
          }
        />
      )}
    </div>
  );
};

type RowProps = {
  message: ChatMessage;
  /** Stable for the whole list — does not invalidate the row memo. */
  chatRef: ChatRef;
  prev: ChatMessage | undefined;
  next: ChatMessage | undefined;
  authorsById: Map<string, ChatMessageAuthor>;
};

const Row = memo(function Row({
  message,
  chatRef,
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
          chatRef={chatRef}
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
        chatRef={chatRef}
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
