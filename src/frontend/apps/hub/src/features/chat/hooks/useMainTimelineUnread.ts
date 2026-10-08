import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatMainTimelineUnread,
  ChatMessage,
  ChatRef,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

const READ_RETRY_MAX_MS = 8_000;

type Projection = Pick<
  ChatMainTimelineUnread,
  "hasUnread" | "firstUnreadId" | "unreadCount" | "readUpToId"
> & {
  throughId: string;
};

const isEligibleUnreadMessage = (message: ChatMessage): boolean =>
  message.authorId !== "me" && message.isDeleted !== true;

/**
 * The driver knows the first unread message only when the read marker was in
 * memory. Otherwise it appears once the marker is loaded, like Element's read
 * marker line: on scrolling up, or when navigation opens the window around it.
 */
const resolveFirstUnreadId = (
  state:
    | Pick<Projection, "hasUnread" | "firstUnreadId" | "readUpToId">
    | null
    | undefined,
  messages: ChatMessage[],
): string | null => {
  if (!state?.hasUnread) {
    return null;
  }
  if (state.firstUnreadId) {
    return state.firstUnreadId;
  }
  const markerIndex = state.readUpToId
    ? messages.findIndex((message) => message.id === state.readUpToId)
    : -1;
  if (markerIndex < 0) {
    return null;
  }
  return (
    messages.slice(markerIndex + 1).find(isEligibleUnreadMessage)?.id ?? null
  );
};

export type UseMainTimelineUnreadResult = ChatMainTimelineUnread & {
  isLoading: boolean;
  isResolving: boolean;
  areAllUnreadVisible: (
    visibleIds: ReadonlySet<string>,
    hasNewer: boolean,
  ) => boolean;
  markVisibleMessages: (
    visibleIds: ReadonlySet<string>,
    hasNewer: boolean,
  ) => void;
  markAllRead: () => void;
};

/**
 * Owns the monotonic local projection and serialised Matrix writes for the
 * main timeline. Rendering rows never marks them read: the caller must pass
 * identities measured inside a stable, focused scroll viewport.
 */
export const useMainTimelineUnread = (
  ref: ChatRef,
  messages: ChatMessage[],
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
  const [projection, setProjection] = useState<Projection | null>(null);
  const projectionRef = useRef<Projection | null>(null);
  // Latest boundary wins while a write is running. This coalesces rapid scroll
  // measurements without allowing an older queued write to move the marker
  // backwards afterwards.
  const queuedBoundaryRef = useRef<string | null>(null);
  const writingRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const updateProjection = useCallback((next: Projection | null) => {
    projectionRef.current = next;
    if (mountedRef.current) {
      setProjection(next);
    }
  }, []);

  const flushBoundary = useCallback(async () => {
    if (writingRef.current || !queuedBoundaryRef.current) {
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
      const confirmed =
        queryClient.getQueryData<ChatMainTimelineUnread>(queryKey);
      const local = projectionRef.current;
      if (
        local &&
        confirmed?.readUpToId === local.throughId &&
        !queuedBoundaryRef.current
      ) {
        updateProjection(null);
      }
    } catch {
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
  }, [queryClient, queryKey, ref.accountId, ref.chatId, updateProjection]);

  const queueBoundary = useCallback(
    (eventId: string) => {
      queuedBoundaryRef.current = eventId;
      void flushBoundary();
    },
    [flushBoundary],
  );

  useEffect(() => {
    mountedRef.current = true;
    updateProjection(null);
    queuedBoundaryRef.current = null;
    retryCountRef.current = 0;
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [ref.accountId, ref.chatId, updateProjection]);

  useEffect(() => {
    const local = projectionRef.current;
    // Keep the optimistic projection authoritative until Matrix exposes the
    // exact boundary we wrote. A stale /sync echo must not flash older state.
    if (
      local &&
      query.data?.readUpToId === local.throughId &&
      !queuedBoundaryRef.current &&
      !writingRef.current
    ) {
      updateProjection(null);
    }
  }, [query.data, updateProjection]);

  const current = projection ?? query.data;

  const areAllUnreadVisible = useCallback(
    (visibleIds: ReadonlySet<string>, hasNewer: boolean) => {
      const firstUnreadId = resolveFirstUnreadId(
        projectionRef.current ?? query.data,
        messages,
      );
      if (!firstUnreadId || hasNewer) {
        return false;
      }
      const firstUnreadIndex = messages.findIndex(
        (message) => message.id === firstUnreadId,
      );
      if (firstUnreadIndex < 0) {
        return false;
      }

      // The homeserver count can include events this timeline does not show:
      // the loaded messages after the first unread one are the reference.
      const unreadIds = messages
        .slice(firstUnreadIndex)
        .filter(isEligibleUnreadMessage)
        .map((message) => message.id);
      return (
        unreadIds.length > 0 &&
        unreadIds.every((eventId) => visibleIds.has(eventId))
      );
    },
    [messages, query.data],
  );

  const markVisibleMessages = useCallback(
    (visibleIds: ReadonlySet<string>, hasNewer: boolean) => {
      const state = projectionRef.current ?? query.data;
      const firstUnreadId = resolveFirstUnreadId(state, messages);
      if (!state || !firstUnreadId) {
        return;
      }
      const firstUnreadIndex = messages.findIndex(
        (message) => message.id === firstUnreadId,
      );
      if (firstUnreadIndex < 0) {
        return;
      }

      let consumedCount = 0;
      let throughId: string | null = null;
      let nextFirstUnreadId: string | null = null;
      // Progress only through the contiguous visible prefix of eligible unread
      // events. A later visible row cannot skip an unread gap above it.
      for (let index = firstUnreadIndex; index < messages.length; index += 1) {
        const message = messages[index];
        if (!isEligibleUnreadMessage(message)) {
          continue;
        }
        if (!visibleIds.has(message.id)) {
          nextFirstUnreadId = message.id;
          break;
        }
        consumedCount += 1;
        throughId = message.id;
      }
      if (!throughId) {
        return;
      }

      // The loaded messages decide what is left; the homeserver count only
      // gives the number, and no number once it no longer matches.
      const hasUnread = nextFirstUnreadId !== null || hasNewer;
      let unreadCount: number | null = 0;
      if (hasUnread) {
        const remaining = (state.unreadCount ?? 0) - consumedCount;
        unreadCount = remaining > 0 ? remaining : null;
      }
      const next: Projection = {
        hasUnread,
        readUpToId: throughId,
        firstUnreadId: hasUnread ? nextFirstUnreadId : null,
        unreadCount,
        throughId,
      };
      updateProjection(next);
      queueBoundary(throughId);
    },
    [messages, query.data, queueBoundary, updateProjection],
  );

  const markAllRead = useCallback(() => {
    const state = projectionRef.current ?? query.data;
    const liveEndId = query.data?.liveEndId;
    if (!state?.hasUnread || !liveEndId) {
      return;
    }
    updateProjection({
      hasUnread: false,
      readUpToId: liveEndId,
      firstUnreadId: null,
      unreadCount: state.unreadCount === null ? null : 0,
      throughId: liveEndId,
    });
    queueBoundary(liveEndId);
  }, [query.data, queueBoundary, updateProjection]);

  return useMemo(
    () => ({
      hasUnread: current?.hasUnread ?? false,
      readUpToId: current?.readUpToId ?? null,
      firstUnreadId: resolveFirstUnreadId(current, messages),
      unreadCount: current?.unreadCount ?? null,
      liveEndId: query.data?.liveEndId ?? null,
      isLoading: query.isPending,
      isResolving: query.isFetching,
      areAllUnreadVisible,
      markVisibleMessages,
      markAllRead,
    }),
    [
      areAllUnreadVisible,
      current,
      markAllRead,
      markVisibleMessages,
      messages,
      query.data?.liveEndId,
      query.isFetching,
      query.isPending,
    ],
  );
};
