import { useQuery } from "@tanstack/react-query";

import { getHubApi } from "@/features/config/HubApi";

import { chatKeys } from "../chatKeys";

/** How often an ongoing call is checked for its end, in milliseconds. */
const ONGOING_CALL_REFRESH_INTERVAL = 5000;

/**
 * Live status of a call. The Hub has no push channel yet, so an ongoing call
 * is polled until it ends; an ended call never changes again.
 */
export const useCall = (callId: string) =>
  useQuery({
    queryKey: chatKeys.call(callId),
    queryFn: () => getHubApi().getCall(callId),
    refetchInterval: ({ state }) =>
      state.data?.status === "ongoing" ? ONGOING_CALL_REFRESH_INTERVAL : false,
    staleTime: ({ state }) => (state.data?.status === "ended" ? Infinity : 0),
    retry: false,
    meta: { noGlobalError: true },
  });
