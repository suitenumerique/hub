import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getHubApi } from "@/features/config/HubApi";
import { useApiConfig } from "@/features/config/useApiConfig";

import { chatKeys } from "../chatKeys";

/** How often the ongoing calls are refreshed, in milliseconds. */
const ONGOING_CALLS_REFRESH_INTERVAL = 5000;

const NO_CHATS: ReadonlySet<string> = new Set();

/**
 * Ids of the conversations, among the given ones, in which a call is ongoing.
 * Polled like the status of a single call (see `useCall`), with one request
 * for the whole conversation list.
 */
export const useOngoingCalls = (
  chatIds: readonly string[],
): ReadonlySet<string> => {
  const { data: config } = useApiConfig();
  // Sorted so that reordering the conversation list does not refetch.
  const sortedChatIds = useMemo(() => [...chatIds].sort(), [chatIds]);

  const { data } = useQuery({
    queryKey: chatKeys.ongoingCalls(sortedChatIds),
    queryFn: () => getHubApi().getOngoingCalls(sortedChatIds),
    enabled: Boolean(config?.MEET_ENABLED) && sortedChatIds.length > 0,
    refetchInterval: ONGOING_CALLS_REFRESH_INTERVAL,
    placeholderData: (previous) => previous,
    retry: false,
    meta: { noGlobalError: true },
  });

  return useMemo(
    () => (data ? new Set(data.map((call) => call.chat_service_id)) : NO_CHATS),
    [data],
  );
};
