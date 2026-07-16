import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { Chat, ChatRef, ChatSections } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

const withName = (chat: Chat, name: string): Chat => ({
  ...chat,
  name,
  ...(chat.hubGroup
    ? {
        hubGroup: {
          ...chat.hubGroup,
          name,
        },
      }
    : {}),
});

export const useRenameChat = (ref: ChatRef, enabled: boolean) => {
  const queryClient = useQueryClient();
  const driver = getRegistry().get(ref.accountId);
  const capability = useQuery({
    queryKey: chatKeys.renameCapability(ref),
    queryFn: () => driver.canRenameChat(ref.chatId),
    enabled: enabled && driver.supportsChatRename,
    staleTime: 15_000,
    meta: { noGlobalError: true },
  });
  const mutation = useMutation<void, Error, string>({
    mutationFn: (name) => driver.renameChat(ref.chatId, name),
    onSuccess: (_result, name) => {
      const normalizedName = name.trim();
      // This is applied only after Matrix accepted the state event, so it is a
      // confirmed local echo rather than an optimistic registry projection.
      queryClient.setQueryData<Chat>(chatKeys.chat(ref), (chat) =>
        chat ? withName(chat, normalizedName) : chat,
      );
      queryClient.setQueryData<ChatSections>(
        chatKeys.chatsOf(ref.accountId),
        (sections) =>
          sections
            ? {
                favourites: sections.favourites.map((chat) =>
                  chat.id === ref.chatId
                    ? withName(chat, normalizedName)
                    : chat,
                ),
                all: sections.all.map((chat) =>
                  chat.id === ref.chatId
                    ? withName(chat, normalizedName)
                    : chat,
                ),
              }
            : sections,
      );
      void queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() });
    },
    meta: { noGlobalError: true },
  });

  const renameChat = useCallback(
    (name: string) => mutation.mutateAsync(name),
    [mutation],
  );

  return {
    canRename: capability.data === true,
    isChecking: enabled && capability.isPending,
    renameChat,
    isRenaming: mutation.isPending,
  };
};
