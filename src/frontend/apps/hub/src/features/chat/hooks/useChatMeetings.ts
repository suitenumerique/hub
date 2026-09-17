import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  getRegistry,
  useDriverEntries,
} from "@/features/drivers/DriverRegistry";
import type { ChatMeeting, ChatRef } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

const EMPTY_MEETINGS: ChatMeeting[] = [];

export type UseChatMeetingsResult = {
  meetings: ChatMeeting[];
  isSupported: boolean;
  isInitialLoading: boolean;
};

/** Meetings held in a conversation, newest first (see `MatrixDriver.getChatMeetings`). */
export const useChatMeetings = (
  ref: ChatRef | null,
  enabled: boolean,
): UseChatMeetingsResult => {
  const entries = useDriverEntries();
  const isSupported = useMemo(
    () =>
      ref
        ? (entries.find((entry) => entry.accountId === ref.accountId)?.driver
            .supportsMeetings ?? false)
        : false,
    [entries, ref],
  );

  const query = useQuery({
    queryKey: ref ? chatKeys.meetings(ref) : chatKeys.noChat(),
    queryFn: () =>
      ref
        ? getRegistry().get(ref.accountId).getChatMeetings(ref.chatId)
        : Promise.resolve(EMPTY_MEETINGS),
    enabled: enabled && ref !== null && isSupported,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  return {
    meetings: query.data ?? EMPTY_MEETINGS,
    isSupported,
    isInitialLoading: query.isPending && query.fetchStatus !== "idle",
  };
};
