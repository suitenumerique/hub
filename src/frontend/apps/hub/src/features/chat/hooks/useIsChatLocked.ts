import type { ChatSecuritySnapshot } from "@/features/drivers/security";
import type { AccountId, ChatRef } from "@/features/drivers/types";

import { useMessageUnlock } from "../MessageUnlockContext";

import { useChat } from "./useChat";
import { useChatSecurity } from "./useChatSecurity";

/** Whether this device was never verified, its history then being unreadable. */
export const isDeviceUnverified = (security: ChatSecuritySnapshot): boolean =>
  security.supported &&
  (security.trust === "unverified" || security.trust === "missing-identity");

/**
 * Whether another device can verify this one now. Without any, the messages
 * received here keep showing: there is nothing to unlock them with yet.
 */
export const canUnlockDevice = (security: ChatSecuritySnapshot): boolean =>
  security.supported &&
  security.trust === "unverified" &&
  (security.referenceDeviceCount ?? 0) > 0;

/**
 * Whether the conversation waits for this device to be unlocked, until the
 * unlocking under way is over. Without a conversation, `newChatAccountId` is
 * the account of the one being prepared, which will be encrypted.
 */
export const useIsChatLocked = (
  ref: ChatRef | null,
  newChatAccountId: AccountId | null,
): boolean => {
  const accountId = ref?.accountId ?? newChatAccountId;
  const { security } = useChatSecurity(accountId);
  const { session } = useMessageUnlock();
  const { chat } = useChat(ref);
  const isUnlocking = accountId !== null && session?.accountId === accountId;
  if (!isUnlocking && !canUnlockDevice(security)) {
    return false;
  }
  // An unresolved policy does not prove the conversation is encrypted.
  return ref ? chat?.encryption === "encrypted" : accountId !== null;
};
