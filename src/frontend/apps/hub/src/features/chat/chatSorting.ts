import type { Chat } from "@/features/drivers/types";

export type ChatRankingActivity = (chat: Chat) => string | undefined;

/** Builds the stable room comparator from the activity cursor to rank with. */
export const compareChatsWithActivity =
  (getRankingActivityAt: ChatRankingActivity) =>
  (a: Chat, b: Chat): number => {
    const aActivityAt = getRankingActivityAt(a);
    const bActivityAt = getRankingActivityAt(b);
    const aTime = aActivityAt ? Date.parse(aActivityAt) : 0;
    const bTime = bActivityAt ? Date.parse(bActivityAt) : 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) {
      return byName;
    }
    const byAccount = a.accountId.localeCompare(b.accountId);
    if (byAccount !== 0) {
      return byAccount;
    }
    return a.id.localeCompare(b.id);
  };

export const compareChats = compareChatsWithActivity(
  (chat) => chat.lastActivityAt,
);
