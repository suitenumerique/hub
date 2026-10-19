import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { AccountId } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

/**
 * Requested square size in device pixels: twice the largest avatar (40px) for
 * sharp screens, and a size homeservers usually generate in advance.
 */
const AVATAR_SIZE = 96;

const AVATAR_QUERY = chatKeys.avatar("", "")[0];

/**
 * One object URL per avatar image, shared by every avatar that shows it and
 * known from the first render: a remounted row (virtualized list, another
 * conversation, the thread panel) shows its picture at once instead of its
 * initials first.
 */
const objectUrls = new WeakMap<Blob, string>();
const watchedClients = new WeakSet<QueryClient>();

const objectUrlFor = (blob: Blob): string => {
  let url = objectUrls.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    objectUrls.set(blob, url);
  }
  return url;
};

/** Revokes an avatar's object URL once its image leaves the cache. */
const revokeRemovedAvatars = (queryClient: QueryClient): void => {
  if (watchedClients.has(queryClient)) {
    return;
  }
  watchedClients.add(queryClient);
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "removed" || event.query.queryKey[0] !== AVATAR_QUERY) {
      return;
    }
    const blob: unknown = event.query.state.data;
    const url = blob instanceof Blob ? objectUrls.get(blob) : undefined;
    if (blob instanceof Blob && url) {
      URL.revokeObjectURL(url);
      objectUrls.delete(blob);
    }
  });
};

/**
 * Object URL of a conversation's or a person's avatar, loaded through the
 * account's driver: Matrix media needs an `Authorization` header, so a plain
 * `<img src>` cannot point at the homeserver. Undefined while loading, without
 * avatar or account, or on failure.
 */
export const useChatAvatarUrl = (
  accountId: AccountId | null,
  avatarUrl: string | undefined,
): string | undefined => {
  const queryClient = useQueryClient();
  useEffect(() => revokeRemovedAvatars(queryClient), [queryClient]);
  const { data } = useQuery({
    queryKey: chatKeys.avatar(accountId ?? "", avatarUrl ?? ""),
    queryFn: ({ signal }) =>
      getRegistry()
        .get(accountId!)
        .getChatAvatar({ avatarUrl: avatarUrl!, size: AVATAR_SIZE, signal }),
    enabled: Boolean(accountId && avatarUrl),
    // One request per image: a new avatar has a new URL, hence a new key.
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    // A missing image is common and permanent: keep the initials.
    retry: false,
    meta: { noGlobalError: true },
  });
  return accountId && avatarUrl && data ? objectUrlFor(data) : undefined;
};
