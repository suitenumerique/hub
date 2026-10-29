import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { AccountId, ChatRef, ChatUnread } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

const READ: ChatUnread = {
  unread: false,
  highlight: false,
  markedUnread: false,
};

export type ChatUnreadLookup = (ref: ChatRef) => ChatUnread;

/**
 * Loads each driver's read-state slice once, then exposes a cheap lookup for
 * rows and the active timeline. Live receipts patch these query entries through
 * `useChatEvents`; the conversation and message caches stay untouched.
 */
export const useChatUnread = (): ChatUnreadLookup => {
  const entries = useDriverEntries();
  // A plain object, which React Query keeps as long as no read state changed:
  // the lookup below then stays the same, and so do the memoized rows.
  const combine = useCallback(
    (results: UseQueryResult<Record<string, ChatUnread>>[]) => {
      const byAccount: Partial<Record<AccountId, Record<string, ChatUnread>>> =
        {};
      entries.forEach((entry, index) => {
        const unread = results[index]?.data;
        if (unread) {
          byAccount[entry.accountId] = unread;
        }
      });
      return byAccount;
    },
    [entries],
  );
  const byAccount = useQueries({
    queries: entries.map(({ accountId, driver }) => ({
      queryKey: chatKeys.unreadOf(accountId),
      queryFn: () => driver.getUnread(),
      staleTime: Infinity,
      meta: { noGlobalError: true },
    })),
    combine,
  });

  return useCallback(
    (ref: ChatRef): ChatUnread =>
      byAccount[ref.accountId]?.[ref.chatId] ?? READ,
    [byAccount],
  );
};
