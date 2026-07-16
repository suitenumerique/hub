import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { decorateChat } from "@/features/chat/chatRefs";
import {
  applyHubGroupsToChat,
  getHubGroupCandidateRoomIds,
  hubGroupResolutionQueryOptions,
  type HubGroupResolutionSnapshot,
} from "@/features/chat/hubGroups";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { Chat, ChatRef, ChatSections } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export type UseChatResult = {
  chat: Chat | null;
  isInitialLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

/**
 * Loads a single conversation through the matching account driver. Keyed by
 * full `ChatRef` so identical local ids from different accounts never collide.
 */
export const useChat = (ref: ChatRef | null): UseChatResult => {
  const queryClient = useQueryClient();
  const driver = ref ? getRegistry().get(ref.accountId) : null;
  const query = useQuery({
    queryKey: ref ? chatKeys.chat(ref) : chatKeys.noChat(),
    queryFn: async () => {
      if (!ref) {
        throw new Error("useChat requires a ChatRef.");
      }
      return decorateChat(ref.accountId, await driver!.getChat(ref.chatId));
    },
    enabled: ref !== null,
    staleTime: Infinity,
    // Seed from the already-loaded conversation list so the chat's membership
    // (invite vs join) is known on the first render, before `getChat` resolves.
    // Without it, opening a pending invitation from the list would briefly
    // render the conversation surface — and fire `getChatMessages` against the
    // not-yet-joined room — until `getChat` classified it as an invite.
    placeholderData: () => {
      if (!ref) {
        return undefined;
      }
      const sections = queryClient.getQueryData<ChatSections>(
        chatKeys.chatsOf(ref.accountId),
      );
      return (
        sections?.favourites.find((chat) => chat.id === ref.chatId) ??
        sections?.all.find((chat) => chat.id === ref.chatId)
      );
    },
    meta: { noGlobalError: true },
  });

  const candidateRoomIds = query.data
    ? getHubGroupCandidateRoomIds([query.data])
    : [];
  const lastResolutionQuery = useQuery({
    queryKey: chatKeys.lastResolvedHubGroupsOf(ref?.accountId ?? "none"),
    queryFn: async (): Promise<HubGroupResolutionSnapshot> => ({
      candidateRoomIds: [],
      groups: [],
    }),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const isResolvedBySidebar = candidateRoomIds.every(
    (roomId) =>
      lastResolutionQuery.data?.candidateRoomIds.includes(roomId) ||
      lastResolutionQuery.data?.groups.some((group) =>
        group.rooms.some((room) => room.room_id === roomId),
      ),
  );
  const groupQuery = useQuery({
    ...hubGroupResolutionQueryOptions(
      driver,
      ref?.accountId ?? "none",
      candidateRoomIds,
    ),
    enabled:
      Boolean(ref && driver?.supportsHubGroupCreation && query.data) &&
      candidateRoomIds.length > 0 &&
      !isResolvedBySidebar,
  });

  const refetch = useCallback(() => {
    void query.refetch();
    if (candidateRoomIds.length > 0 && !isResolvedBySidebar) {
      void groupQuery.refetch();
    }
  }, [candidateRoomIds.length, groupQuery, isResolvedBySidebar, query]);

  const chat = query.data
    ? applyHubGroupsToChat(
        query.data,
        groupQuery.data ?? lastResolutionQuery.data?.groups ?? [],
      )
    : null;

  return {
    chat,
    isInitialLoading: query.isPending,
    isError: query.isError,
    refetch,
  };
};
