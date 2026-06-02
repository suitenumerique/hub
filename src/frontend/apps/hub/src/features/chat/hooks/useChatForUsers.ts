import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getDriver } from "@/features/config/Config";
import type { Chat } from "@/features/drivers/types";

export type UseChatForUsersResult = {
  chat: Chat | null;
  isInitialLoading: boolean;
  isError: boolean;
};

export const normalizeChatParticipantIds = (userIds: string[]) =>
  [...new Set(userIds)].sort();

export const useChatForUsers = (userIds: string[]): UseChatForUsersResult => {
  const driver = getDriver();
  const participantIds = useMemo(
    () => normalizeChatParticipantIds(userIds),
    [userIds],
  );

  const query = useQuery({
    queryKey: ["chat-for-users", participantIds],
    queryFn: () => driver.getChatForUsers(participantIds),
    enabled: participantIds.length > 0,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  return {
    chat: query.data ?? null,
    isInitialLoading: query.isPending && participantIds.length > 0,
    isError: query.isError,
  };
};
