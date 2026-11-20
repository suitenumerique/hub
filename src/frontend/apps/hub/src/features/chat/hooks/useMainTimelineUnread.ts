import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatMainTimelineUnread, ChatRef } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

const READ_RETRY_MAX_MS = 8_000;

export type UseMainTimelineUnreadResult = ChatMainTimelineUnread & {
  isLoading: boolean;
  /**
   * Reads the conversation through its latest message, or through
   * `lastLoadedId` when the latest messages hold none.
   */
  markAllRead: (lastLoadedId?: string) => void;
};

/**
 * Unread state of the main timeline and its serialised Matrix writes. While a
 * read is being written, the conversation already shows as read.
 */
export const useMainTimelineUnread = (
  ref: ChatRef,
): UseMainTimelineUnreadResult => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => chatKeys.mainTimelineUnread(ref),
    [ref.accountId, ref.chatId],
  );
  const query = useQuery({
    queryKey,
    queryFn: () =>
      getRegistry().get(ref.accountId).getMainTimelineUnread(ref.chatId),
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });
  const [readingThroughId, setReadingThroughId] = useState<string | null>(null);
  // Latest boundary wins while a write is running, without an older queued
  // write moving the marker backwards afterwards.
  const queuedBoundaryRef = useRef<string | null>(null);
  // Last boundary asked for, so that a count the homeserver has yet to clear
  // does not send the same receipt again.
  const askedBoundaryRef = useRef<string | null>(null);
  const writingRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const isUnmountedRef = useRef(false);

  const flushBoundary = useCallback(async () => {
    if (
      isUnmountedRef.current ||
      writingRef.current ||
      !queuedBoundaryRef.current
    ) {
      return;
    }
    writingRef.current = true;
    try {
      while (queuedBoundaryRef.current) {
        const eventId: string = queuedBoundaryRef.current;
        await getRegistry()
          .get(ref.accountId)
          .markChatReadThrough(ref.chatId, eventId);
        retryCountRef.current = 0;
        if (queuedBoundaryRef.current === eventId) {
          queuedBoundaryRef.current = null;
        }
      }
      await queryClient.invalidateQueries({ queryKey, exact: true });
      // The driver keeps a written boundary until `/sync` echoes it back: a
      // stale echo cannot bring older state back from here on.
      if (!queuedBoundaryRef.current) {
        setReadingThroughId(null);
      }
    } catch {
      // A failure after leaving the conversation is not retried: nothing would
      // ever stop the retries of one that keeps failing.
      if (isUnmountedRef.current) {
        return;
      }
      const delay = Math.min(
        1_000 * 2 ** retryCountRef.current,
        READ_RETRY_MAX_MS,
      );
      retryCountRef.current += 1;
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        void flushBoundary();
      }, delay);
    } finally {
      writingRef.current = false;
      if (queuedBoundaryRef.current && retryTimerRef.current === null) {
        void flushBoundary();
      }
    }
  }, [queryClient, queryKey, ref.accountId, ref.chatId]);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  const hasUnread = readingThroughId ? false : (query.data?.hasUnread ?? false);
  const isReceiptBehind = readingThroughId
    ? false
    : (query.data?.isReceiptBehind ?? false);
  const liveEndId = query.data?.liveEndId ?? null;
  const liveEndReceiptId = query.data?.liveEndReceiptId ?? null;

  const markAllRead = useCallback(
    (lastLoadedId?: string) => {
      const eventId = liveEndId ?? lastLoadedId;
      if (!eventId) {
        return;
      }
      // Like Element, with nothing left to read, a receipt behind the latest
      // events is still sent, as for a message deleted before it was read:
      // once for the event it goes on, as its echo may take a while.
      const receiptId =
        (eventId === liveEndId ? liveEndReceiptId : null) ?? eventId;
      const movesReceipt =
        isReceiptBehind && askedBoundaryRef.current !== receiptId;
      if (!hasUnread && !movesReceipt) {
        return;
      }
      askedBoundaryRef.current = receiptId;
      setReadingThroughId(eventId);
      queuedBoundaryRef.current = eventId;
      void flushBoundary();
    },
    [flushBoundary, hasUnread, isReceiptBehind, liveEndId, liveEndReceiptId],
  );

  return useMemo(
    () => ({
      hasUnread,
      isReceiptBehind,
      readUpToId: readingThroughId ?? query.data?.readUpToId ?? null,
      firstUnreadId: readingThroughId
        ? null
        : (query.data?.firstUnreadId ?? null),
      liveEndId,
      liveEndReceiptId,
      isLoading: query.isPending,
      markAllRead,
    }),
    [
      hasUnread,
      isReceiptBehind,
      liveEndId,
      liveEndReceiptId,
      markAllRead,
      query.data?.firstUnreadId,
      query.data?.readUpToId,
      query.isPending,
      readingThroughId,
    ],
  );
};
