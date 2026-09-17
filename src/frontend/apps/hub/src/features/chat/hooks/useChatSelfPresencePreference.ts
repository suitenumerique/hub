import { useQuery } from "@tanstack/react-query";

import { chatKeys } from "@/features/chat/chatKeys";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type {
  AccountId,
  ChatSelfPresencePreference,
} from "@/features/drivers/types";

/** Persisted manual mode for one account; distinct from observed Matrix state. */
export const useChatSelfPresencePreference = (
  accountId: AccountId,
): ChatSelfPresencePreference | null => {
  const entries = useDriverEntries();
  const driver = entries.find((entry) => entry.accountId === accountId)?.driver;
  const { data } = useQuery({
    queryKey: chatKeys.selfPresencePreference(accountId),
    queryFn: () => driver?.getSelfPresencePreference() ?? "online",
    enabled: Boolean(driver),
    staleTime: Infinity,
  });

  return data ?? null;
};
