import { isInvitationChat } from "@/features/chat/chatMembership";
import type { Chat } from "@/features/drivers/types";

const isMuted = (chat: Chat): boolean => chat.notificationLevel === "mute";

/**
 * Pending invitations come first, as in Element, so a new one is not lost below
 * newer activity. Muted conversations come last. Each group is sorted by latest
 * activity.
 */
export const compareChats = (a: Chat, b: Chat): number => {
  if (isInvitationChat(a) !== isInvitationChat(b)) {
    return isInvitationChat(a) ? -1 : 1;
  }
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
