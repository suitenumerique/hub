import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import type {
  ChatRef,
  ChatMessage,
  ChatMessageAuthor,
} from "@/features/drivers/types";

import { useChatMessages } from "../hooks/useChatMessages";
import { useChatUnread } from "../hooks/useChatUnread";
import { useMarkChatRead } from "../hooks/useMarkChatRead";

import { ChatBubble } from "./ChatBubble";
import { ChatConversationSkeleton } from "./ChatConversationSkeleton";

type ChatVirtualListProps = {
  chatRef: ChatRef;
};

// Average bubble height. Lets Virtuoso lay out rows without waiting on the
// first measurement pass — eliminates the visible "flash" before the list
// snaps to the bottom on chat open / switch.
const DEFAULT_ITEM_HEIGHT = 72;

// How long the user must dwell (focused + at bottom) before the conversation is
// marked read — avoids clearing a room that was only glanced at.
const MARK_READ_DEBOUNCE_MS = 500;

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
  const chatKey = `${chatRef.accountId}:${chatRef.chatId}`;
  const lastMessage = messages[messages.length - 1];

  // Keep one Virtuoso instance alive across chat switches — remounting it on
  // every chat change costs ~500ms of measurement + layout, which is what
  // made switching feel sluggish.
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const previousChatRef = useRef(chatRef);
  const previousAppendState = useRef({
    chatKey,
    messageCount: messages.length,
    lastMessageId: lastMessage?.id ?? null,
  });
  const atBottomRef = useRef(true);
  // Set while a freshly appended message should stay pinned to the bottom.
  // Virtuoso estimates row heights before measuring, so the first scroll can
  // land a few px short; `totalListHeightChanged` re-pins once the real height
  // is known. Cleared as soon as the viewport actually reaches the bottom.
  const shouldStickToBottomRef = useRef(false);
  const pendingScrollRaf = useRef<number | null>(null);

  // Mirror of the loading flag, read inside the chat-switch effect so a cached
  // re-open scrolls instantly (`auto`) and only a real first load animates.
  const isInitialLoadingRef = useRef(isInitialLoading);
  isInitialLoadingRef.current = isInitialLoading;

  const markChatRead = useMarkChatRead(chatRef);
  const isUnread = useChatUnread()(chatRef).unread;
  const lastMarkedEventIdRef = useRef<string | null>(null);
  const markReadTimerRef = useRef<number | null>(null);

  // Mark the conversation read only while the user is genuinely viewing it:
  // window focused AND scrolled to the bottom, the conversation is unread, and
  // there is something newer than what was already marked. Debounced and
  // re-checked at fire time; the driver also no-ops when the room is already read.
  const maybeMarkRead = useCallback(() => {
    if (!isUnread || !atBottomRef.current) {
      return;
    }
    if (typeof document !== "undefined" && !document.hasFocus()) {
      return;
    }
    const latestId = lastMessage?.id;
    if (!latestId || lastMarkedEventIdRef.current === latestId) {
      return;
    }
    if (markReadTimerRef.current !== null) {
      window.clearTimeout(markReadTimerRef.current);
    }
    markReadTimerRef.current = window.setTimeout(() => {
      markReadTimerRef.current = null;
      if (!atBottomRef.current || !document.hasFocus()) {
        return;
      }
      lastMarkedEventIdRef.current = latestId;
      markChatRead();
    }, MARK_READ_DEBOUNCE_MS);
  }, [isUnread, lastMessage?.id, markChatRead]);

  // Fires on open of an unread chat and on each new latest message while viewing;
  // the at-bottom transition and focus-regain paths are wired separately below.
  useEffect(() => {
    maybeMarkRead();
  }, [maybeMarkRead]);

  // Re-evaluate when the window regains focus; clear the pending timer on unmount.
  useEffect(() => {
    window.addEventListener("focus", maybeMarkRead);
    return () => {
      window.removeEventListener("focus", maybeMarkRead);
      if (markReadTimerRef.current !== null) {
        window.clearTimeout(markReadTimerRef.current);
      }
    };
  }, [maybeMarkRead]);

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
    // New conversation: allow it to be marked read once viewed.
    lastMarkedEventIdRef.current = null;
    // A cached re-open is already painted, so jump to the bottom instantly
    // (`auto`); only a genuine first load animates. The smooth-scroll-on-every-
    // switch is what made revisiting a cached conversation feel non-instant.
    const behavior: ScrollBehavior = isInitialLoadingRef.current
      ? "smooth"
      : "auto";
    // Two rAFs: the first lets React commit the new `data` + `firstItemIndex`,
    // the second lets Virtuoso recompute its internal layout before we ask it
    // to scroll to the last row.
    pendingScrollRaf.current = requestAnimationFrame(() => {
      pendingScrollRaf.current = requestAnimationFrame(() => {
        pendingScrollRaf.current = null;
        virtuosoRef.current?.scrollToIndex({
          index: "LAST",
          align: "end",
          behavior,
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

  // Scroll so the latest message's bottom aligns with the viewport bottom,
  // through Virtuoso's measurement-aware API rather than touching `scrollTop`
  // directly — on a virtualised list the scroller's `scrollHeight` is only an
  // estimate, so manual `scrollTop = scrollHeight` overshoots and janks.
  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: "LAST",
      align: "end",
      behavior: "auto",
    });
  }, []);

  // Stick to the bottom when a new latest message arrives — but only when the
  // reader is already at the bottom, or it is their own send (they expect to
  // follow it even from an older scroll position). `followOutput` handles the
  // "already at bottom" case on its own; this covers "my own send while
  // scrolled up", which `followOutput` deliberately ignores.
  useLayoutEffect(() => {
    const previous = previousAppendState.current;
    const isSameChat = previous.chatKey === chatKey;
    const didAppendLatest =
      messages.length > previous.messageCount &&
      lastMessage?.id !== previous.lastMessageId;
    const shouldFollowAppend =
      atBottomRef.current || lastMessage?.authorId === "me";
    previousAppendState.current = {
      chatKey,
      messageCount: messages.length,
      lastMessageId: lastMessage?.id ?? null,
    };

    if (!isSameChat || !didAppendLatest || !shouldFollowAppend) {
      return;
    }

    shouldStickToBottomRef.current = true;
    scrollToBottom();
  }, [
    chatKey,
    lastMessage?.authorId,
    lastMessage?.id,
    messages.length,
    scrollToBottom,
  ]);

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
          followOutput="auto"
          atBottomStateChange={(atBottom) => {
            atBottomRef.current = atBottom;
            if (atBottom) {
              shouldStickToBottomRef.current = false;
              // Reaching the bottom while focused is the signal to mark read.
              maybeMarkRead();
            }
          }}
          totalListHeightChanged={() => {
            // Re-pin to the bottom while a stick is pending: the just-appended
            // row's real height differs from the initial estimate, and that
            // height change would otherwise leave a gap below the last message.
            if (shouldStickToBottomRef.current) {
              scrollToBottom();
            }
          }}
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
