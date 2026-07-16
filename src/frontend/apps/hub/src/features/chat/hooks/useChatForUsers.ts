import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { decorateChat } from "@/features/chat/chatRefs";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { Chat } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";
import { isInvitationChat } from "../chatMembership";

import { useComposerAccountId } from "./useChatAccounts";
import { useChats } from "./useChats";

export type UseChatForUsersResult = {
  chat: Chat | null;
  isInitialLoading: boolean;
  isError: boolean;
};

export const normalizeChatParticipantIds = (userIds: string[]) =>
  [...new Set(userIds)].sort();

export const useChatForUsers = (userIds: string[]): UseChatForUsersResult => {
  const accountId = useComposerAccountId();
  const participantIds = useMemo(
    () => normalizeChatParticipantIds(userIds),
    [userIds],
  );
  const chats = useChats();

  const query = useQuery({
    queryKey: chatKeys.chatForUsers(accountId, participantIds),
    queryFn: async () => {
      if (!accountId) {
        return null;
      }
      const driver = getRegistry().get(accountId);
      const localChat = await driver.getChatForUsers(participantIds);
      if (!localChat) {
        return null;
      }
      return decorateChat(accountId, localChat);
    },
    enabled: participantIds.length > 0 && accountId !== null,
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  const resolvedGroupChat = useMemo(() => {
    // An empty New Chat selection must always keep the placeholder visible.
    if (!accountId || participantIds.length === 0) {
      return null;
    }
    const sections = chats.byAccount.get(accountId);
    return (
      [...(sections?.favourites ?? []), ...(sections?.all ?? [])].find(
        (candidate) =>
          candidate.kind === "hub_group" &&
          // Pending invitations become current only when opened from the list.
          !isInvitationChat(candidate) &&
          normalizeChatParticipantIds(candidate.participantIds).join(" ") ===
            participantIds.join(" "),
      ) ?? null
    );
  }, [accountId, chats.byAccount, participantIds]);

  return {
    chat: resolvedGroupChat ?? query.data ?? null,
    isInitialLoading:
      participantIds.length > 0 &&
      (query.isPending || chats.isResolvingHubGroups),
    isError:
      query.isError || Boolean(accountId && chats.accountErrors.has(accountId)),
  };
};
