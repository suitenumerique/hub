import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { compareChats } from "@/features/chat/chatSorting";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { Chat, ChatRef, ChatSections } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { chatKeys } from "../chatKeys";

type FavouriteMutationContext = {
  previousChat?: Chat;
  previousSections?: ChatSections;
};

const moveChat = (
  sections: ChatSections | undefined,
  chatId: string,
  favourite: boolean,
): ChatSections | undefined => {
  if (!sections) {
    return sections;
  }
  const current = [...sections.favourites, ...sections.all].find(
    (chat) => chat.id === chatId,
  );
  if (!current) {
    return sections;
  }
  const moved: Chat = {
    ...current,
    section: favourite ? "favourites" : "all",
  };
  const withoutCurrent = (chats: Chat[]) =>
    chats.filter((chat) => chat.id !== chatId);

  return {
    favourites: [
      ...withoutCurrent(sections.favourites),
      ...(favourite ? [moved] : []),
    ].sort(compareChats),
    all: [...withoutCurrent(sections.all), ...(favourite ? [] : [moved])].sort(
      compareChats,
    ),
  };
};

export type UseChatFavouriteResult = {
  setFavourite: (favourite: boolean) => void;
  isPending: boolean;
};

export const useChatFavourite = (ref: ChatRef): UseChatFavouriteResult => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { mutate, isPending } = useMutation<
    void,
    Error,
    boolean,
    FavouriteMutationContext
  >({
    mutationFn: (favourite) =>
      getRegistry().get(ref.accountId).setChatFavourite(ref.chatId, favourite),
    onMutate: async (favourite) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: chatKeys.chatsOf(ref.accountId),
        }),
        queryClient.cancelQueries({ queryKey: chatKeys.chat(ref) }),
      ]);
      const previousSections = queryClient.getQueryData<ChatSections>(
        chatKeys.chatsOf(ref.accountId),
      );
      const previousChat = queryClient.getQueryData<Chat>(chatKeys.chat(ref));

      queryClient.setQueryData<ChatSections>(
        chatKeys.chatsOf(ref.accountId),
        (sections) => moveChat(sections, ref.chatId, favourite),
      );
      queryClient.setQueryData<Chat>(chatKeys.chat(ref), (chat) =>
        chat
          ? {
              ...chat,
              section: favourite ? "favourites" : "all",
            }
          : chat,
      );
      return { previousChat, previousSections };
    },
    onError: (_error, favourite, context) => {
      if (context?.previousSections) {
        queryClient.setQueryData(
          chatKeys.chatsOf(ref.accountId),
          context.previousSections,
        );
      }
      if (context?.previousChat) {
        queryClient.setQueryData(chatKeys.chat(ref), context.previousChat);
      }
      notify.error(
        favourite
          ? t(
              "The conversation could not be added to favourites. Please try again.",
            )
          : t(
              "The conversation could not be removed from favourites. Please try again.",
            ),
      );
    },
    meta: { noGlobalError: true },
  });

  const setFavourite = useCallback(
    (favourite: boolean) => mutate(favourite),
    [mutate],
  );

  return { setFavourite, isPending };
};
