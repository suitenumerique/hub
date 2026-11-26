import type { ChatSecuritySnapshot } from "@/features/drivers/security";
import type { AccountId, ChatRef } from "@/features/drivers/types";

import { useMessageUnlock } from "../MessageUnlockContext";

import { useChat } from "./useChat";
import { useChatSecurity } from "./useChatSecurity";

/**
 * Whether another device can verify this one now. Without any, the messages
 * received here keep showing: there is nothing to unlock them with yet.
 */
export const canUnlockDevice = (security: ChatSecuritySnapshot): boolean =>
  security.supported &&
  security.trust === "unverified" &&
  (security.referenceDeviceCount ?? 0) > 0;

/**
 * Whether this device was never verified, its history then being unreadable.
 * Only once its other devices are known: until then, nothing tells how to
 * verify it.
 */
const isDeviceUnverified = (security: ChatSecuritySnapshot): boolean =>
  security.supported &&
  security.referenceDeviceCount !== undefined &&
  (security.trust === "unverified" || security.trust === "missing-identity");

/** `true` while the card unlocks the account, `false` once it verified it. */
const useUnlocking = (accountId: AccountId | null): boolean | undefined => {
  const { session, verifiedAccountIds } = useMessageUnlock();
  if (accountId === null) {
    return undefined;
  }
  if (session?.accountId === accountId) {
    return true;
  }
  return verifiedAccountIds.includes(accountId) ? false : undefined;
};

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
  const unlocking = useUnlocking(accountId);
  const { chat } = useChat(ref);
  if (!(unlocking ?? canUnlockDevice(security))) {
    return false;
  }
  // An unresolved policy does not prove the conversation is encrypted.
  return ref ? chat?.encryption === "encrypted" : accountId !== null;
};

/** The home page hides nothing: it also says what to do before unlocking. */
export const useIsHomeLocked = (accountId: AccountId | null): boolean => {
  const { security } = useChatSecurity(accountId);
  return useUnlocking(accountId) ?? isDeviceUnverified(security);
};
