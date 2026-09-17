import { useQuery } from "@tanstack/react-query";

import { chatKeys } from "@/features/chat/chatKeys";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { AccountId, ChatUserPresence } from "@/features/drivers/types";

/**
 * Presence currently known for one user in one chat account. Initial data is
 * read from the driver's local store; live updates are written by
 * `useChatEvents`. This hook never subscribes to the driver itself.
 */
export const useChatUserPresence = (
  accountId: AccountId,
  userId: string,
): ChatUserPresence | null => {
  const entries = useDriverEntries();
  const driver = entries.find((entry) => entry.accountId === accountId)?.driver;
  const { data } = useQuery({
    queryKey: chatKeys.userPresence(accountId, userId),
    queryFn: () => driver?.getUserPresence(userId) ?? null,
    enabled: Boolean(driver && userId),
    staleTime: Infinity,
  });

  return data ?? null;
};
