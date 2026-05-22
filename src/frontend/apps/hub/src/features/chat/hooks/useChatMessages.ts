import { useInfiniteQuery } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import { getDriver } from '@/features/config/Config';
import type { ChatMessage, ChatMessageAuthor } from '@/features/drivers/types';
import { StoreType } from '@/features/drivers/Driver';
import { useIsDriverReady } from '@/features/drivers/components/useDriver';
import {
  ChatTimeline,
  ChatTimelineSnapshot,
  ChatTimelineStore,
} from '@/features/matrix/stores/ChatTimelineStore';

export const CHAT_PAGE_SIZE = 50;

// Virtuoso uses a virtual index space. We start from a high anchor so that
// prepending older messages stays in positive territory; `firstItemIndex` is
// the anchor minus the number of currently loaded messages, and Virtuoso uses
// it to keep the visible scroll position stable across prepends.
const VIRTUOSO_INDEX_ANCHOR = 1_000_000;

export type UseChatMessagesResult = {
  messages: ChatMessage[];
  authorsById: Map<string, ChatMessageAuthor> | undefined;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  isInitialLoading: boolean;
  isError: boolean;
  /** First virtual item index for Virtuoso. See `VIRTUOSO_INDEX_ANCHOR`. */
  firstItemIndex: number;
  fetchOlder: () => void;
};

const EMPTY_TIMELINE_SNAPSHOT: ChatTimelineSnapshot = {
  currentChatId: '',
  timelineByChatId: new Map<string, ChatTimeline>(),
};
export const useChatMessages = (chatId: string): UseChatMessagesResult => {
  const { isLoading, setIsLoading } = useState(true);

  const driver = getDriver();
  const isDriverReady = useIsDriverReady();

  const store: ChatTimelineStore | null = useMemo(() => {
    if (!driver || !isDriverReady) return null;
    setIsLoading(false);
    return driver.getStore(StoreType.Chattimeline) as ChatTimelineStore;
  }, [driver, isDriverReady]);

  const subscribe = useCallback(
    (listener: CallableFunction) => {
      if (!store) return () => {}; // No-op when null
      return store.subscribe(listener);
    },
    [store], // ← When store changes, new callback reference is created
  );

  const getSnapshot = useCallback(() => {
    if (!store) return EMPTY_TIMELINE_SNAPSHOT;
    return store.getSnapshot() as ChatTimelineSnapshot;
  }, [store]);

  // Then in the hook, after the store is created and before useSyncExternalStore:
  useEffect(() => {
    if (!store) return;
    store.setCurrentChatId(chatId);
  }, [store, chatId]);

  const { timelineByChatId } = useSyncExternalStore(subscribe, getSnapshot);

  const messages = useMemo(() => {
    const timeline: ChatTimeline | undefined = timelineByChatId.get(chatId);
    if (!timeline) {
      return [];
    }
    return timeline.messages;
  }, [timelineByChatId.get(chatId)]);

  const fetchOlder = useCallback(() => {
    const timeline: ChatTimeline | undefined = timelineByChatId.get(chatId);
    if (
      store &&
      timeline &&
      timeline.canPaginateBack &&
      !timeline.isPaginating
    ) {
      void store.paginateBack(chatId);
    }
  }, [timelineByChatId.get(chatId)]);

  return {
    messages,
    authorsById: timelineByChatId.get(chatId)?.authors,
    hasOlder: !!timelineByChatId.get(chatId)?.canPaginateBack,
    isFetchingOlder: !!timelineByChatId.get(chatId)?.isPaginating,
    isInitialLoading: isLoading,
    isError: false,
    firstItemIndex: VIRTUOSO_INDEX_ANCHOR - messages.length,
    fetchOlder,
  };
};
