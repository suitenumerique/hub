import { useQueries } from "@tanstack/react-query";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { AccountId, ChatRef, ChatUnread } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";
import { CHAT_SESSION_QUERY_OPTIONS } from "../queryOptions";

const READ: ChatUnread = { unread: false, highlight: false };

/** Looks up a conversation's read state; defaults to "read" when unknown. */
export type ChatUnreadLookup = (ref: ChatRef) => ChatUnread;

/**
 * Reads the per-account read-state slice (`chatId → ChatUnread`) across every
 * active driver, seeded once by `driver.getUnread()` and patched live by the
 * `unread:changed` bridge (see `useChatEvents`). Decoupled from the conversation
 * and message caches: a dot moving never refetches or re-renders them. Returns a
 * lookup so callers read a single conversation's state without re-subscribing.
 */
export const useChatUnread = (): ChatUnreadLookup => {
  const entries = useDriverEntries();

  return useQueries({
    queries: entries.map((entry) => ({
      queryKey: chatKeys.unreadOf(entry.accountId),
      queryFn: () => entry.driver.getUnread(),
      ...CHAT_SESSION_QUERY_OPTIONS,
      meta: { noGlobalError: true },
    })),
    combine: (results) => {
      const byAccount = new Map<AccountId, Record<string, ChatUnread>>();
      entries.forEach((entry, index) => {
        const data = results[index]?.data;
        if (data) {
          byAccount.set(entry.accountId, data);
        }
      });
      return (ref: ChatRef): ChatUnread =>
        byAccount.get(ref.accountId)?.[ref.chatId] ?? READ;
    },
  });
};
