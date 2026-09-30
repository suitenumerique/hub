import { useCallback, useSyncExternalStore } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import { EMPTY_SECURITY } from "@/features/drivers/security";
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

export const useCanSendToChat = (ref: ChatRef | null): boolean => {
  const { security } = useChatSecurity(ref?.accountId ?? null);
  const { chat } = useChat(ref);
  // Unknown room policy must block just like an unready encrypted room. This
  // is a UI guard; the driver rechecks policy and trust at the time of sending.
  return (
    !security.supported ||
    (!!chat &&
      chat.encryption !== "unknown" &&
      (chat.encryption === "plaintext" || security.canSendEncrypted))
  );
};
