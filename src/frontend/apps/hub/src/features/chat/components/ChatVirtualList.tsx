import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import type {
  ChatMessage,
  ChatMessageWindow,
  ChatRef,
} from "@/features/drivers/types";

import { useChatMessages } from "../hooks/useChatMessages";
import {
  type MainTimelineUnreadNavigation,
  type MainTimelineViewportState,
  useMainTimelineUnread,
} from "../hooks/useMainTimelineUnread";
import { useChatUnreadState } from "../hooks/useChatUnread";
import { useMarkChatRead } from "../hooks/useMarkChatRead";

import { ChatConversationSkeleton } from "./ChatConversationSkeleton";
import { ChatMessageRow } from "./ChatMessageRow";
import { UnreadSeparator } from "./UnreadSeparator";

export type { MainTimelineUnreadNavigation } from "../hooks/useMainTimelineUnread";

type ChatVirtualListProps = {
  chatRef: ChatRef;
  onUnreadNavigationChange?: (
    update: MainTimelineUnreadNavigationUpdate,
  ) => void;
};

export type MainTimelineUnreadNavigationUpdate = {
  chatKey: string;
  navigation: MainTimelineUnreadNavigation | null;
};

type MessageTimelineRow = {
  kind: "message";
  key: string;
  message: ChatMessage;
};

type ReadMarkerTimelineRow = {
  kind: "read-marker";
  key: string;
  eventId: string;
};

type ChatTimelineRow = MessageTimelineRow | ReadMarkerTimelineRow;

type MeasuredRow = {
  index: number;
  rect: DOMRect;
};

const DEFAULT_ITEM_HEIGHT = 72;

type SkeletonState = "visible" | "leaving" | "hidden";

const buildTimelineRows = (
  messages: ChatMessage[],
  readMarker: ChatMessageWindow["readMarker"],
): ChatTimelineRow[] => {
  const rows: ChatTimelineRow[] = [];
  const markerIndex = readMarker
    ? Math.max(0, Math.min(readMarker.insertionIndex, messages.length))
    : -1;

  for (let index = 0; index <= messages.length; index += 1) {
    if (readMarker && index === markerIndex) {
      rows.push({
        kind: "read-marker",
        key: "read-marker:" + readMarker.eventId,
        eventId: readMarker.eventId,
      });
    }
    const message = messages[index];
    if (message) {
      rows.push({
        kind: "message",
        key: message.id,
        message,
      });
    }
  }

  return rows;
};

const lastMatchingMessageId = (
  measuredRows: MeasuredRow[],
  rows: ChatTimelineRow[],
  predicate: (message: ChatMessage, rowIndex: number) => boolean,
): string | null => {
  for (let index = measuredRows.length - 1; index >= 0; index -= 1) {
    const rowIndex = measuredRows[index].index;
    const row = rows[rowIndex];
    if (row?.kind === "message" && predicate(row.message, rowIndex)) {
      return row.message.id;
    }
  }
  return null;
};

export const ChatVirtualList = ({
  chatRef,
  onUnreadNavigationChange,
}: ChatVirtualListProps) => {
  const { t } = useTranslation();
  const chatKey = chatRef.accountId + ":" + chatRef.chatId;
  const { unread, isPending: isUnreadPending } = useChatUnreadState(chatRef);
  const {
    messages,
    authorsById,
    windowId,
    readMarker,
    frozenReadMarkerEventId,
    hasOlder,
    hasNewer,
    isFetchingOlder,
    isFetchingNewer,
    isInitialLoading,
    isError,
    firstItemIndex,
    fetchOlder,
    fetchNewer,
    openReadMarker,
  } = useChatMessages(chatRef, {
    enabled: !isUnreadPending,
    readMarkerEventId: unread.mainTimelineReadMarkerId,
  });

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const measurementFrame = useRef<number | null>(null);
  const handledJumpRequest = useRef(0);
  const fullyReadProgress = useRef<{
    id: string;
    absoluteIndex: number;
    windowId: string | null;
  } | null>(null);
  const wasConnectedToLive = useRef(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [skeletonState, setSkeletonState] = useState<SkeletonState>("visible");
  const readActions = useMarkChatRead(chatRef);
  const markerMatchesFrozen =
    Boolean(readMarker) && readMarker?.eventId === frozenReadMarkerEventId;
  const markerHasUnreadAfter = Boolean(
    readMarker &&
    (hasNewer ||
      messages
        .slice(readMarker.insertionIndex)
        .some(
          (message) =>
            message.authorId !== "me" &&
            !message.isPending &&
            !message.isDeleted,
        )),
  );
  const actionableMarkerEventId =
    markerMatchesFrozen && !markerHasUnreadAfter
      ? null
      : frozenReadMarkerEventId;
  const readMarkerWindowKey =
    markerMatchesFrozen && markerHasUnreadAfter && windowId && readMarker
      ? [windowId, readMarker.eventId, String(readMarker.insertionIndex)].join(
          ":",
        )
      : null;
  const unreadDomain = useMainTimelineUnread({
    chatKey,
    enabled: !isUnreadPending && !isInitialLoading && isPositioned,
    readMarkerEventId: actionableMarkerEventId,
    readMarkerWindowKey,
    openReadMarker,
    readActions,
  });
  const activeReadMarker =
    unreadDomain.showReadMarker && markerMatchesFrozen && markerHasUnreadAfter
      ? readMarker
      : null;
  // The cached anchor counts the snapshot marker as a row. If the marker is
  // hidden, shift the rendered list so messages below it keep their absolute
  // Virtuoso positions.
  const renderedFirstItemIndex =
    firstItemIndex +
    (readMarker &&
    !activeReadMarker &&
    readMarker.insertionIndex < messages.length
      ? 1
      : 0);
  const rows = useMemo(
    () => buildTimelineRows(messages, activeReadMarker),
    [activeReadMarker, messages],
  );
  const readMarkerRowIndex = rows.findIndex(
    (row) => row.kind === "read-marker",
  );
  const rowsRef = useRef(rows);
  const readMarkerRowIndexRef = useRef(readMarkerRowIndex);
  const onViewportMeasuredRef = useRef(unreadDomain.onViewportMeasured);
  rowsRef.current = rows;
  readMarkerRowIndexRef.current = readMarkerRowIndex;
  onViewportMeasuredRef.current = unreadDomain.onViewportMeasured;

  const wasConnectedToLiveBeforeRender = wasConnectedToLive.current;
  useEffect(() => {
    wasConnectedToLive.current = !hasNewer;
  }, [chatKey, hasNewer]);

  const measureViewport = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const viewport = scroller.getBoundingClientRect();
    const measuredRows = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-chat-timeline-row]"),
    )
      .map((element): MeasuredRow | null => {
        const index = Number(element.dataset.chatRowIndex);
        if (!Number.isInteger(index)) {
          return null;
        }
        return { index, rect: element.getBoundingClientRect() };
      })
      .filter((row): row is MeasuredRow => row !== null)
      .filter(
        ({ rect }) => rect.bottom > viewport.top && rect.top < viewport.bottom,
      )
      .sort((left, right) => left.index - right.index);

    const fullyVisibleRows = measuredRows.filter(
      ({ rect }) => rect.top >= viewport.top && rect.bottom <= viewport.bottom,
    );
    const currentRows = rowsRef.current;
    const markerIndex = readMarkerRowIndexRef.current;
    const isAfterFrozenMarker = (_message: ChatMessage, rowIndex: number) =>
      markerIndex >= 0
        ? rowIndex > markerIndex
        : !frozenReadMarkerEventId || !hasNewer;
    const readReceiptCandidateId = lastMatchingMessageId(
      fullyVisibleRows,
      currentRows,
      (message, rowIndex) =>
        isAfterFrozenMarker(message, rowIndex) &&
        message.authorId !== "me" &&
        !message.isPending &&
        !message.isDeleted,
    );
    const visibleFullyReadCandidateId = lastMatchingMessageId(
      measuredRows,
      currentRows,
      (message, rowIndex) =>
        isAfterFrozenMarker(message, rowIndex) &&
        !message.isPending &&
        !message.isDeleted,
    );
    const previousFullyRead = fullyReadProgress.current;
    if (previousFullyRead) {
      const previousRow = currentRows.find(
        (row) =>
          row.kind === "message" && row.message.id === previousFullyRead.id,
      );
      if (
        previousRow?.kind === "message" &&
        (previousRow.message.isPending || previousRow.message.isDeleted)
      ) {
        fullyReadProgress.current = null;
      }
    }
    if (visibleFullyReadCandidateId) {
      const candidateRowIndex = currentRows.findIndex(
        (row) =>
          row.kind === "message" &&
          row.message.id === visibleFullyReadCandidateId,
      );
      const candidate = {
        id: visibleFullyReadCandidateId,
        absoluteIndex: renderedFirstItemIndex + candidateRowIndex,
        windowId,
      };
      const progress = fullyReadProgress.current;
      if (
        !progress ||
        (progress.windowId === candidate.windowId &&
          candidate.absoluteIndex > progress.absoluteIndex) ||
        (progress.windowId !== candidate.windowId && !hasNewer)
      ) {
        fullyReadProgress.current = candidate;
      }
    }
    const fullyReadCandidateId = fullyReadProgress.current?.id ?? null;

    let readMarkerPosition: MainTimelineViewportState["readMarkerPosition"];
    if (markerIndex < 0) {
      readMarkerPosition = "absent";
    } else {
      const markerRect =
        unreadDomain.separatorRef.current?.getBoundingClientRect();
      if (markerRect) {
        if (markerRect.bottom <= viewport.top) {
          readMarkerPosition = "above";
        } else if (markerRect.top >= viewport.bottom) {
          readMarkerPosition = "below";
        } else {
          readMarkerPosition = "visible";
        }
      } else if (measuredRows.length === 0) {
        readMarkerPosition = "unknown";
      } else if (markerIndex < measuredRows[0].index) {
        readMarkerPosition = "above";
      } else if (markerIndex > measuredRows[measuredRows.length - 1].index) {
        readMarkerPosition = "below";
      } else {
        readMarkerPosition = "unknown";
      }
    }

    onViewportMeasuredRef.current({
      readMarkerPosition,
      readReceiptCandidateId,
      fullyReadCandidateId,
    });
  }, [
    frozenReadMarkerEventId,
    hasNewer,
    renderedFirstItemIndex,
    unreadDomain.separatorRef,
    windowId,
  ]);

  const scheduleViewportMeasurement = useCallback(() => {
    if (measurementFrame.current !== null) {
      return;
    }
    measurementFrame.current = requestAnimationFrame(() => {
      measurementFrame.current = null;
      measureViewport();
    });
  }, [measureViewport]);

  useEffect(
    () => () => {
      if (measurementFrame.current !== null) {
        cancelAnimationFrame(measurementFrame.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (isPositioned) {
      scheduleViewportMeasurement();
    }
  }, [isPositioned, rows, scheduleViewportMeasurement]);

  useEffect(() => {
    if (!isInitialLoading && (rows.length === 0 || isError)) {
      setIsPositioned(true);
    }
  }, [isError, isInitialLoading, rows.length]);

  useEffect(() => {
    if (!isPositioned) {
      setSkeletonState("visible");
      return;
    }
    const frame = requestAnimationFrame(() => {
      setSkeletonState((current) =>
        current === "visible" ? "leaving" : current,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [isPositioned]);

  useEffect(() => {
    if (
      unreadDomain.jumpRequest === 0 ||
      unreadDomain.jumpRequest === handledJumpRequest.current ||
      readMarkerRowIndex < 0
    ) {
      return;
    }
    handledJumpRequest.current = unreadDomain.jumpRequest;
    virtuosoRef.current?.scrollToIndex({
      index: readMarkerRowIndex,
      align: "center",
      behavior: "auto",
    });
    const frame = requestAnimationFrame(() => {
      unreadDomain.separatorRef.current?.focus({ preventScroll: true });
      scheduleViewportMeasurement();
    });
    return () => cancelAnimationFrame(frame);
  }, [
    readMarkerRowIndex,
    scheduleViewportMeasurement,
    unreadDomain.jumpRequest,
    unreadDomain.separatorRef,
  ]);

  const unreadNavigationUpdate = useMemo<MainTimelineUnreadNavigationUpdate>(
    () => ({ chatKey, navigation: unreadDomain.navigation }),
    [chatKey, unreadDomain.navigation],
  );
  useEffect(() => {
    onUnreadNavigationChange?.(unreadNavigationUpdate);
  }, [onUnreadNavigationChange, unreadNavigationUpdate]);
  useEffect(
    () => () => onUnreadNavigationChange?.({ chatKey, navigation: null }),
    [chatKey, onUnreadNavigationChange],
  );

  const handleScrollerRef = useCallback(
    (element: HTMLElement | Window | null) => {
      scrollerRef.current = element instanceof HTMLElement ? element : null;
    },
    [],
  );
  const handleRangeChanged = useCallback(() => {
    setIsPositioned(true);
    scheduleViewportMeasurement();
  }, [scheduleViewportMeasurement]);

  const lastMessage = messages.at(-1);
  const virtuosoComponents = useMemo(
    () => ({
      Header: () => (
        <div className="hub__chat-conversation__top-spacer">
          {isFetchingOlder ? (
            <TimelineStatus label={t("Loading older messages…")} />
          ) : null}
        </div>
      ),
      Footer: () =>
        isFetchingNewer ? (
          <div className="hub__chat-conversation__bottom-loader">
            <TimelineStatus label={t("Loading newer messages…")} />
          </div>
        ) : null,
    }),
    [isFetchingNewer, isFetchingOlder, t],
  );
  const renderRow = useCallback(
    (virtualIndex: number, row: ChatTimelineRow) => {
      const arrayIndex = virtualIndex - renderedFirstItemIndex;
      if (row.kind === "read-marker") {
        return (
          <UnreadSeparator
            ref={unreadDomain.separatorRef}
            eventId={row.eventId}
            rowIndex={arrayIndex}
          />
        );
      }

      const previousRow = rows[arrayIndex - 1];
      const nextRow = rows[arrayIndex + 1];
      return (
        <ChatMessageRow
          message={row.message}
          chatRef={chatRef}
          prev={
            previousRow?.kind === "message" ? previousRow.message : undefined
          }
          next={nextRow?.kind === "message" ? nextRow.message : undefined}
          authorsById={authorsById}
          rowIndex={arrayIndex}
        />
      );
    },
    [
      authorsById,
      chatRef,
      renderedFirstItemIndex,
      rows,
      unreadDomain.separatorRef,
    ],
  );

  return (
    <div className="hub__chat-conversation__list">
      {!isInitialLoading ? (
        <Virtuoso
          ref={virtuosoRef}
          scrollerRef={handleScrollerRef}
          data={rows}
          firstItemIndex={renderedFirstItemIndex}
          computeItemKey={(_index, row) => row.key}
          defaultItemHeight={DEFAULT_ITEM_HEIGHT}
          initialTopMostItemIndex={Math.max(0, rows.length - 1)}
          followOutput={(atBottom) =>
            !hasNewer &&
            (atBottom ||
              (lastMessage?.authorId === "me" && lastMessage.isPending) ||
              (wasConnectedToLiveBeforeRender &&
                lastMessage?.authorId === "me"))
              ? "auto"
              : false
          }
          isScrolling={(isScrolling) => {
            if (!isScrolling) {
              scheduleViewportMeasurement();
            }
          }}
          rangeChanged={handleRangeChanged}
          startReached={hasOlder ? fetchOlder : undefined}
          endReached={hasNewer ? fetchNewer : undefined}
          components={virtuosoComponents}
          itemContent={renderRow}
        />
      ) : null}
      {skeletonState !== "hidden" ? (
        <ChatConversationSkeleton
          leaving={skeletonState === "leaving"}
          onLeaveEnd={() =>
            setSkeletonState((current) =>
              current === "leaving" ? "hidden" : current,
            )
          }
        />
      ) : null}
    </div>
  );
};

const TimelineStatus = ({ label }: { label: string }) => (
  <div
    className="hub__chat-conversation__top-loader"
    role="status"
    data-loading
  >
    <span className="material-icons" aria-hidden="true">
      sync
    </span>
    {label}
  </div>
);
