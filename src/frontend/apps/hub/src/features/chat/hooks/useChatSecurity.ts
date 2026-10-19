import { useCallback, useSyncExternalStore } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import {
  type ChatSecuritySnapshot,
  EMPTY_SECURITY,
} from "@/features/drivers/security";
import type { AccountId, ChatRef } from "@/features/drivers/types";
import { useChat } from "./useChat";

export const useChatSecurity = (accountId: AccountId | null) => {
  const entries = useDriverEntries();
  const driver = entries.find((entry) => entry.accountId === accountId)?.driver;
  const subscribe = useCallback(
    (listener: () => void) =>
      driver?.subscribeToSecurity(listener) ?? (() => {}),
    [driver],
  );
  const getSnapshot = useCallback(
    () => driver?.getSecuritySnapshot() ?? EMPTY_SECURITY,
    [driver],
  );
  return {
    driver,
    security: useSyncExternalStore(subscribe, getSnapshot, getSnapshot),
  };
};

/**
 * `checking` while the conversation, its encryption policy or this device's
 * security are still being resolved: sending waits, but nothing asks the user
 * to set up encryption. `blocked` once that work proves this device cannot
 * write to the conversation.
 */
export type ChatSendState = "ready" | "checking" | "blocked";

/**
 * Send state of an encrypted conversation. Every page load starts with
 * `trust: "checking"`, and a verified device can only send once its backup
 * check ends; a failed check reports an `issue` and blocks. As in Element,
 * nothing is reported to the user before the first check has run.
 */
export const securitySendState = (
  security: ChatSecuritySnapshot,
): ChatSendState => {
  if (!security.supported || security.canSendEncrypted) {
    return "ready";
  }
  const checking =
    security.trust === "checking" ||
    (security.trust === "verified" && security.backup === "checking");
  return checking && !security.issue ? "checking" : "blocked";
};

export const useChatSendState = (ref: ChatRef | null): ChatSendState => {
  const { security } = useChatSecurity(ref?.accountId ?? null);
  const { chat, isError } = useChat(ref);
  // Unknown room policy must block just like an unready encrypted room. This
  // is a UI guard; the driver rechecks policy and trust at the time of sending.
  if (!security.supported) {
    return "ready";
  }
  if (!chat) {
    return isError ? "blocked" : "checking";
  }
  if (chat.encryption === "plaintext") {
    return "ready";
  }
  if (chat.encryption === "unknown") {
    return "checking";
  }
  return securitySendState(security);
};
