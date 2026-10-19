import { useQuery } from "@tanstack/react-query";

import {
  getRegistry,
  useDriverEntries,
} from "@/features/drivers/DriverRegistry";
import type { AccountId, ChatUser } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

// Matrix sends no event for the user's own profile: refresh it now and then,
// and when the window regains focus.
const PROFILE_STALE_TIME = 5 * 60_000;

/**
 * The connected user's own profile on an account that is its own identity
 * (Tchap). `null` for accounts that show the Hub user, and until the account
 * is connected and its profile loaded.
 */
export const useChatAccountProfile = (
  accountId: AccountId | null,
  chatUserId: string | null,
): ChatUser | null => {
  const entries = useDriverEntries();
  const hasOwnIdentity =
    entries.find((entry) => entry.accountId === accountId)?.identity ===
    "account";
  const enabled = Boolean(hasOwnIdentity && accountId && chatUserId);
  const { data } = useQuery({
    queryKey: chatKeys.profile(accountId ?? "", chatUserId ?? ""),
    queryFn: () => getRegistry().get(accountId!).getChatProfile(),
    enabled,
    staleTime: PROFILE_STALE_TIME,
    meta: { noGlobalError: true },
  });
  return enabled ? (data ?? null) : null;
};
