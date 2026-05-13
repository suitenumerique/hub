import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { Chat } from '@/features/drivers/types';
import { StoreType } from '@/features/drivers/Driver';
import {
  useDriver,
  useIsDriverReady,
} from '@/features/drivers/components/useDriver';

const EMPTY_CHAT_LIST: Chat[] = [];

export const useChatList = (): Chat[] => {
  const driver = useDriver();
  const isDriverReady = useIsDriverReady();
  const store = useMemo(() => {
    console.log('*** usechatlist store', driver);
    if (!driver || !isDriverReady) return null;
    return driver.getStore(StoreType.ChatList);
  }, [driver, isDriverReady]);

  const subscribe = useCallback(
    (listener: CallableFunction) => {
      if (!store) return () => {}; // No-op when null
      return store.subscribe(listener);
    },
    [store], // ← When store changes, new callback reference is created
  );

  const getSnapshot = useCallback(() => {
    console.log('*** in snapshot usechatlist store', store);
    if (!store) return EMPTY_CHAT_LIST;
    console.log('*** in snapshot usechatlist ', store.getSnapshot());
    return store.getSnapshot() as Chat[];
  }, [store]);

  return useSyncExternalStore(subscribe, getSnapshot);
};
