import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  Chat,
  ChatEffectiveNotificationLevel,
  ChatRef,
  ChatSections,
} from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { chatKeys } from "../chatKeys";

type NotificationLevelMutationContext = {
  previousChat?: Chat;
  previousSections?: ChatSections;
};

const withLevel = (
  chat: Chat,
  level: ChatEffectiveNotificationLevel,
): Chat => ({
  ...chat,
  notificationLevel: level,
  effectiveNotificationLevel: level,
});

export type UseChatNotificationLevelResult = {
  setLevel: (level: ChatEffectiveNotificationLevel) => void;
  isPending: boolean;
};

export const useChatNotificationLevel = (
  ref: ChatRef,
): UseChatNotificationLevelResult => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { mutate, isPending } = useMutation<
    void,
    Error,
    ChatEffectiveNotificationLevel,
    NotificationLevelMutationContext
  >({
    mutationFn: (level) =>
      getRegistry()
        .get(ref.accountId)
        .setChatNotificationLevel(ref.chatId, level),
    onMutate: async (level) => {
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

      const update = (chats: Chat[]) =>
        chats.map((chat) =>
          chat.id === ref.chatId ? withLevel(chat, level) : chat,
        );
      queryClient.setQueryData<ChatSections>(
        chatKeys.chatsOf(ref.accountId),
        (sections) =>
          sections && {
            favourites: update(sections.favourites),
            all: update(sections.all),
          },
      );
      queryClient.setQueryData<Chat>(
        chatKeys.chat(ref),
        (chat) => chat && withLevel(chat, level),
      );
      return { previousChat, previousSections };
    },
    onError: (_error, _level, context) => {
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
        t("The notification level could not be changed. Please try again."),
      );
    },
    meta: { noGlobalError: true },
  });

  const setLevel = useCallback(
    (level: ChatEffectiveNotificationLevel) => mutate(level),
    [mutate],
  );

  return { setLevel, isPending };
};
