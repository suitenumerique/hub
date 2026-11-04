import type { Chat } from "@/features/drivers/types";

const isMuted = (chat: Chat): boolean => chat.notificationLevel === "mute";

/** Muted conversations come last, each group sorted by latest activity. */
export const compareChats = (a: Chat, b: Chat): number => {
  if (isMuted(a) !== isMuted(b)) {
    return isMuted(a) ? 1 : -1;
  }
  const aTime = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
  const bTime = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;

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
