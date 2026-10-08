import { useQuery } from "@tanstack/react-query";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { AccountId } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";
import { useObjectUrl } from "./useChatAttachmentUrl";

/**
 * Requested square size in device pixels: twice the largest avatar (40px) for
 * sharp screens, and a size homeservers usually generate in advance.
 */
const AVATAR_SIZE = 96;

/**
 * Object URL of a conversation's avatar, loaded through its driver: Matrix
 * media needs an `Authorization` header, so a plain `<img src>` cannot point
 * at the homeserver. Undefined while loading, without avatar, or on failure.
 */
export const useChatAvatarUrl = (
  accountId: AccountId,
  avatarUrl: string | undefined,
): string | undefined => {
  const { data } = useQuery({
    queryKey: chatKeys.avatar(accountId, avatarUrl ?? ""),
    queryFn: ({ signal }) =>
      getRegistry()
        .get(accountId)
        .getChatAvatar({ avatarUrl: avatarUrl!, size: AVATAR_SIZE, signal }),
    enabled: Boolean(avatarUrl),
    // One request per image: a new avatar has a new URL, hence a new key.
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    // A missing image is common and permanent: keep the initials.
    retry: false,
    meta: { noGlobalError: true },
  });
  return useObjectUrl(avatarUrl ? data : undefined);
};
