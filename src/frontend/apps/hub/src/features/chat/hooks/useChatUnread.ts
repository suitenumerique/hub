import { useQueries, useQuery } from "@tanstack/react-query";

import {
  getRegistry,
  useDriverEntries,
} from "@/features/drivers/DriverRegistry";
import type { AccountId, ChatRef, ChatUnread } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

const READ: ChatUnread = {
  unread: false,
  highlight: false,
  mainTimelineReadMarkerId: null,
};

export type ChatUnreadLookup = (ref: ChatRef) => ChatUnread;

/** Read state for the active conversation, including cache readiness. */
export const useChatUnreadState = (
  ref: ChatRef,
): { unread: ChatUnread; isPending: boolean } => {
  const query = useQuery({
    queryKey: chatKeys.unreadOf(ref.accountId),
    queryFn: () => getRegistry().get(ref.accountId).getUnread(),
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });
  return {
    unread: query.data?.[ref.chatId] ?? READ,
    isPending: query.isPending,
  };
};

/**
 * Loads each driver's read-state slice once, then exposes a cheap lookup for
 * rows and the active timeline. Live receipts patch these query entries through
 * `useChatEvents`; the conversation and message caches stay untouched.
 */
export const useChatUnread = (): ChatUnreadLookup => {
  const entries = useDriverEntries();

  return useQueries({
    queries: entries.map(({ accountId, driver }) => ({
      queryKey: chatKeys.unreadOf(accountId),
      queryFn: () => driver.getUnread(),
      staleTime: Infinity,
      meta: { noGlobalError: true },
    })),
    combine: (results) => {
      const byAccount = new Map<AccountId, Record<string, ChatUnread>>();
      entries.forEach((entry, index) => {
        const unread = results[index]?.data;
        if (unread) {
          byAccount.set(entry.accountId, unread);
        }
      });
      return (ref: ChatRef): ChatUnread =>
        byAccount.get(ref.accountId)?.[ref.chatId] ?? READ;
    },
  });
};
