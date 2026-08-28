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
  ChatMessage,
  ChatMessageAuthor,
  ChatRef,
} from "@/features/drivers/types";

import { useChatMessages } from "../hooks/useChatMessages";
import { useChatUnreadState } from "../hooks/useChatUnread";
import { useMarkChatRead } from "../hooks/useMarkChatRead";

import { ChatBubble } from "./ChatBubble";
import { ChatConversationSkeleton } from "./ChatConversationSkeleton";
import { UnreadSeparator } from "./UnreadSeparator";

type ChatVirtualListProps = {
  chatRef: ChatRef;
};

const DEFAULT_ITEM_HEIGHT = 72;
const MARK_READ_DEBOUNCE_MS = 500;
const MARK_READ_RETRY_MAX_MS = 8000;

type SkeletonState = "visible" | "leaving" | "hidden";

export const ChatVirtualList = ({ chatRef }: ChatVirtualListProps) => {
  const { t } = useTranslation();
  const chatKey = `${chatRef.accountId}:${chatRef.chatId}`;
  const { unread, isPending: isUnreadPending } = useChatUnreadState(chatRef);
  const isUnread = unread.unread;
  const {
    messages,
    authorsById,
    firstUnreadMessageId,
    anchorStatus,
    hasOlder,
    hasNewer,
    isFetchingOlder,
    isFetchingNewer,
    isInitialLoading,
    firstItemIndex,
    fetchOlder,
    fetchNewer,
  } = useChatMessages(chatRef, {
    anchor: isUnread ? "first-unread" : "latest",
    enabled: !isUnreadPending,
  });
  const lastMessage = messages[messages.length - 1];
  const markChatRead = useMarkChatRead(chatRef);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | Window | null>(null);
  const previousAppendState = useRef({
    chatKey,
    messageCount: messages.length,
    lastMessageId: lastMessage?.id ?? null,
  });
  const atBottomRef = useRef(true);
  const shouldStickToBottomRef = useRef(false);
  const pendingScrollRaf = useRef<number | null>(null);
  const pendingScrollTimer = useRef<number | null>(null);
  const lastMarkedKeyRef = useRef<string | null>(null);
  const markReadTimerRef = useRef<number | null>(null);
  const markReadRetryCountRef = useRef(0);
  const [markReadRetryTick, setMarkReadRetryTick] = useState(0);
  const [positionedChatKey, setPositionedChatKey] = useState<string | null>(
    null,
  );
  const [clearedBoundaryChatKey, setClearedBoundaryChatKey] = useState<
    string | null
  >(null);

  /** Mark only the true live end, never the bottom of a contextual window. */
  const maybeMarkRead = useCallback(() => {
    const latestId = lastMessage?.id;
    const markerKey = latestId ? `${chatKey}:${latestId}` : null;
    if (!isUnread) {
      markReadRetryCountRef.current = 0;
      return;
    }
    if (
      isInitialLoading ||
      hasNewer ||
      positionedChatKey !== chatKey ||
      !atBottomRef.current ||
      !markerKey ||
      lastMarkedKeyRef.current === markerKey ||
      (typeof document !== "undefined" && !document.hasFocus())
    ) {
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
      lastMarkedKeyRef.current = markerKey;
      void markChatRead()
        .then(() => {
          markReadRetryCountRef.current = 0;
          setClearedBoundaryChatKey(chatKey);
        })
        .catch(() => {
          if (lastMarkedKeyRef.current !== markerKey) {
            return;
          }
          lastMarkedKeyRef.current = null;
          const retryDelay = Math.min(
            1000 * 2 ** markReadRetryCountRef.current,
            MARK_READ_RETRY_MAX_MS,
          );
          markReadRetryCountRef.current += 1;
          markReadTimerRef.current = window.setTimeout(() => {
            markReadTimerRef.current = null;
            setMarkReadRetryTick((current) => current + 1);
          }, retryDelay);
        });
    }, MARK_READ_DEBOUNCE_MS);
  }, [
    chatKey,
    hasNewer,
    isInitialLoading,
    isUnread,
    lastMessage?.id,
    markChatRead,
    positionedChatKey,
  ]);

  useEffect(() => {
    lastMarkedKeyRef.current = null;
    markReadRetryCountRef.current = 0;
    setPositionedChatKey(null);
    setClearedBoundaryChatKey(null);
    return () => {
      lastMarkedKeyRef.current = null;
    };
  }, [chatKey]);

  useEffect(() => {
    maybeMarkRead();
    window.addEventListener("focus", maybeMarkRead);
    return () => {
      window.removeEventListener("focus", maybeMarkRead);
      if (markReadTimerRef.current !== null) {
        window.clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = null;
      }
    };
  }, [markReadRetryTick, maybeMarkRead]);

  const [skeletonState, setSkeletonState] = useState<SkeletonState>("visible");
  const needsInitialPosition =
    isInitialLoading || positionedChatKey !== chatKey;

  useEffect(() => {
    if (needsInitialPosition) {
      setSkeletonState("visible");
      return;
    }
    const raf = requestAnimationFrame(() => {
      setSkeletonState((current) =>
        current === "visible" ? "leaving" : current,
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [needsInitialPosition]);

  // Once the anchored window is rendered, place the first unread row one
  // third from the viewport top. The separator stays inside that row, so
  // Virtuoso's item indexes remain identical to the message indexes.
  useEffect(() => {
    if (
      isInitialLoading ||
      positionedChatKey === chatKey ||
      anchorStatus === null
    ) {
      return;
    }
    const firstUnreadIndex = firstUnreadMessageId
      ? messages.findIndex((message) => message.id === firstUnreadMessageId)
      : -1;

    // Virtuoso performs its own delayed initial scroll while it measures the
    // first rendered rows. Wait for that cycle before applying our anchor so
    // its internal retry cannot move the conversation back to the live end.
    pendingScrollTimer.current = window.setTimeout(() => {
      pendingScrollTimer.current = null;
      pendingScrollRaf.current = requestAnimationFrame(() => {
        pendingScrollRaf.current = null;
        if (firstUnreadIndex >= 0 && anchorStatus === "resolved") {
          // Virtuoso reports its initial bottom state before this imperative
          // anchor is applied. Clear that provisional value so it cannot
          // advance Matrix's markers while the unread row is still moving.
          atBottomRef.current = false;
          const scrollerHeight =
            scrollerRef.current && "clientHeight" in scrollerRef.current
              ? scrollerRef.current.clientHeight
              : 0;
          virtuosoRef.current?.scrollToIndex({
            index: firstUnreadIndex,
            align: "start",
            offset: -Math.round(scrollerHeight / 3),
            behavior: "auto",
          });
        } else {
          virtuosoRef.current?.scrollToIndex({
            index: "LAST",
            align: "end",
            behavior: "auto",
          });
        }
        setPositionedChatKey(chatKey);
      });
    }, 250);
    return () => {
      if (pendingScrollTimer.current !== null) {
        window.clearTimeout(pendingScrollTimer.current);
        pendingScrollTimer.current = null;
      }
      if (pendingScrollRaf.current !== null) {
        cancelAnimationFrame(pendingScrollRaf.current);
        pendingScrollRaf.current = null;
      }
    };
  }, [
    anchorStatus,
    chatKey,
    firstUnreadMessageId,
    isInitialLoading,
    messages,
    positionedChatKey,
  ]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: "LAST",
      align: "end",
      behavior: "auto",
    });
  }, []);

  // New live events never change the anchored separator. Follow only when the
  // loaded window has reached the live end and the reader is already there,
  // or when the newly appended message is their own send.
  useLayoutEffect(() => {
    const previous = previousAppendState.current;
    const isSameChat = previous.chatKey === chatKey;
    const didAppendLatest =
      messages.length > previous.messageCount &&
      lastMessage?.id !== previous.lastMessageId;
    const shouldFollowAppend =
      !hasNewer &&
      (atBottomRef.current || lastMessage?.authorId === "me");
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
    hasNewer,
    lastMessage?.authorId,
    lastMessage?.id,
    messages.length,
    scrollToBottom,
  ]);

  const hasActiveUnreadBoundary =
    isUnread && clearedBoundaryChatKey !== chatKey;
  const showUnreadSeparator =
    hasActiveUnreadBoundary &&
    anchorStatus === "resolved" &&
    firstUnreadMessageId !== null;
  const isLocatingUnread =
    isUnread &&
    (isUnreadPending || (isInitialLoading && anchorStatus === null));

  return (
    <div className="hub__chat-conversation__list">
      {!isInitialLoading && (
        <Virtuoso
          ref={virtuosoRef}
          scrollerRef={(element) => {
            scrollerRef.current = element;
          }}
          data={messages}
          firstItemIndex={firstItemIndex}
          computeItemKey={(_index, message) => message.id}
          defaultItemHeight={DEFAULT_ITEM_HEIGHT}
          initialTopMostItemIndex={Math.max(0, messages.length - 1)}
          followOutput="auto"
          atBottomStateChange={(atBottom) => {
            atBottomRef.current = atBottom;
            if (atBottom) {
              shouldStickToBottomRef.current = false;
              maybeMarkRead();
            }
          }}
          totalListHeightChanged={() => {
            if (shouldStickToBottomRef.current) {
              scrollToBottom();
            }
          }}
          startReached={hasOlder ? fetchOlder : undefined}
          endReached={hasNewer ? fetchNewer : undefined}
          increaseViewportBy={{ top: 400, bottom: 400 }}
          components={{
            Header: () => (
              <div className="hub__chat-conversation__top-spacer">
                {isFetchingOlder && (
                  <TimelineStatus label={t("Loading older messages…")} />
                )}
              </div>
            ),
            Footer: () =>
              isFetchingNewer ? (
                <div className="hub__chat-conversation__bottom-loader">
                  <TimelineStatus label={t("Loading newer messages…")} />
                </div>
              ) : null,
          }}
          itemContent={(virtualIndex, message) => {
            const arrayIndex = virtualIndex - firstItemIndex;
            const isFirstUnread =
              showUnreadSeparator && message.id === firstUnreadMessageId;
            const nextMessage = messages[arrayIndex + 1];
            return (
              <Row
                message={message}
                chatRef={chatRef}
                prev={isFirstUnread ? undefined : messages[arrayIndex - 1]}
                next={
                  nextMessage?.id === firstUnreadMessageId
                    ? undefined
                    : nextMessage
                }
                authorsById={authorsById}
                showUnreadSeparator={isFirstUnread}
              />
            );
          }}
        />
      )}
      {!isInitialLoading &&
        hasActiveUnreadBoundary &&
        anchorStatus === "unavailable" && (
          <div className="hub__chat-conversation__unread-unavailable">
            <TimelineStatus
              label={t("Unread messages are above")}
              icon="north"
              loading={false}
            />
          </div>
        )}
      {skeletonState !== "hidden" && (
        <ChatConversationSkeleton
          leaving={skeletonState === "leaving"}
          status={
            isLocatingUnread
              ? t("Looking for the first unread message…")
              : undefined
          }
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

const TimelineStatus = ({
  label,
  icon = "sync",
  loading = true,
}: {
  label: string;
  icon?: string;
  loading?: boolean;
}) => (
  <div
    className="hub__chat-conversation__top-loader"
    role="status"
    data-loading={loading || undefined}
  >
    <span className="material-icons" aria-hidden="true">
      {icon}
    </span>
    {label}
  </div>
);

type RowProps = {
  message: ChatMessage;
  chatRef: ChatRef;
  prev: ChatMessage | undefined;
  next: ChatMessage | undefined;
  authorsById: Map<string, ChatMessageAuthor>;
  showUnreadSeparator: boolean;
};

const Row = memo(function Row({
  message,
  chatRef,
  prev,
  next,
  authorsById,
  showUnreadSeparator,
}: RowProps) {
  const isSent = message.authorId === "me";
  const isFirstOfGroup = !prev || prev.authorId !== message.authorId;
  const isLastOfGroup = !next || next.authorId !== message.authorId;

  if (isSent) {
    return (
      <RowShell separator={showUnreadSeparator}>
        <ChatBubble
          variant="sent"
          chatRef={chatRef}
          messageId={message.id}
          content={message.content}
          timestamp={message.timestamp}
          reactions={message.reactions}
          isDeleted={message.isDeleted}
          isEdited={message.isEdited}
          canEdit={message.canEdit}
          canDelete={message.canDelete}
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
    <RowShell separator={showUnreadSeparator}>
      <ChatBubble
        variant="received"
        chatRef={chatRef}
        messageId={message.id}
        content={message.content}
        author={author}
        timestamp={message.timestamp}
        reactions={message.reactions}
        isDeleted={message.isDeleted}
        isEdited={message.isEdited}
        canEdit={message.canEdit}
        canDelete={message.canDelete}
        thread={message.thread}
        showHeader={isFirstOfGroup}
        showAvatar={isLastOfGroup}
      />
    </RowShell>
  );
});

const RowShell = ({
  children,
  separator,
}: {
  children: React.ReactNode;
  separator: boolean;
}) => (
  <div className="hub__chat-conversation__row">
    <div className="hub__chat-conversation__row-inner">
      {separator && <UnreadSeparator />}
      {children}
    </div>
  </div>
);
