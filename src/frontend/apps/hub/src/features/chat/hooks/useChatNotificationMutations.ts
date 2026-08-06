import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type {
  ChatNotificationPreferences,
  ChatNotificationPreferencesByChat,
  ChatRef,
  ChatSections,
  SetChatMutedParams,
  SetChatThreadMutedParams,
} from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { chatKeys } from "../chatKeys";
import { getChatNotificationPreferences } from "./useChatNotificationPreferences";

type RoomMutationContext = {
  hadChat: boolean;
  previousRoom: ChatNotificationPreferences["room"];
};

type ThreadMutationContext = {
  hadChat: boolean;
  hadThread: boolean;
  previousThread?: { muted: boolean };
};

const withoutChat = (
  current: ChatNotificationPreferencesByChat,
  chatId: string,
): ChatNotificationPreferencesByChat => {
  const { [chatId]: _removed, ...rest } = current;
  void _removed;
  return rest;
};

const canRemoveDefaultChat = (
  preferences: ChatNotificationPreferences,
): boolean =>
  !preferences.room.muted &&
  !preferences.room.rankingActivityAt &&
  Object.keys(preferences.threads).length === 0;

const patchRoomMuted = (
  current: ChatNotificationPreferencesByChat | undefined,
  chatId: string,
  muted: boolean,
  rankingActivityAt?: string,
): ChatNotificationPreferencesByChat => {
  const preferences = getChatNotificationPreferences(current, chatId);
  // Keep an existing cursor on unmute. Only post-unmute activity may clear it,
  // otherwise the muted backlog would be replayed into the room ranking.
  return {
    ...(current ?? {}),
    [chatId]: {
      room: {
        ...preferences.room,
        muted,
        ...(muted && !preferences.room.rankingActivityAt && rankingActivityAt
          ? { rankingActivityAt }
          : {}),
      },
      threads: { ...preferences.threads },
    },
  };
};

const patchThreadMuted = (
  current: ChatNotificationPreferencesByChat | undefined,
  { chatId, threadId, muted }: SetChatThreadMutedParams,
): ChatNotificationPreferencesByChat => {
  const preferences = getChatNotificationPreferences(current, chatId);
  return {
    ...(current ?? {}),
    [chatId]: {
      room: { ...preferences.room },
      threads: {
        ...preferences.threads,
        [threadId]: { muted },
      },
    },
  };
};

export type UseChatMuteResult = {
  setMuted: (muted: boolean) => void;
  isPending: boolean;
};

export const useChatMute = (ref: ChatRef): UseChatMuteResult => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const queryKey = chatKeys.notificationPreferencesOf(ref.accountId);
  const { mutate, isPending } = useMutation<
    void,
    Error,
    SetChatMutedParams,
    RoomMutationContext
  >({
    mutationFn: ({ chatId, muted }) =>
      getRegistry().get(ref.accountId).setChatMuted(chatId, muted),
    onMutate: async ({ chatId, muted }) => {
      await queryClient.cancelQueries({ queryKey });
      const current =
        queryClient.getQueryData<ChatNotificationPreferencesByChat>(queryKey);
      const previous = getChatNotificationPreferences(current, chatId);
      const chats = queryClient.getQueryData<ChatSections>(
        chatKeys.chatsOf(ref.accountId),
      );
      const currentActivityAt = [
        ...(chats?.favourites ?? []),
        ...(chats?.all ?? []),
      ].find((chat) => chat.id === chatId)?.lastActivityAt;
      queryClient.setQueryData<ChatNotificationPreferencesByChat>(
        queryKey,
        (cached) => patchRoomMuted(cached, chatId, muted, currentActivityAt),
      );
      return {
        hadChat: current?.[chatId] !== undefined,
        previousRoom: { ...previous.room },
      };
    },
    onError: (_error, { chatId }, context) => {
      if (context) {
        queryClient.setQueryData<ChatNotificationPreferencesByChat>(
          queryKey,
          (cached) => {
            const current = cached ?? {};
            const preferences = getChatNotificationPreferences(current, chatId);
            const restored = {
              ...current,
              [chatId]: {
                room: { ...context.previousRoom },
                threads: { ...preferences.threads },
              },
            };
            return !context.hadChat && canRemoveDefaultChat(restored[chatId])
              ? withoutChat(restored, chatId)
              : restored;
          },
        );
      }
      notify.error(
        t(
          "The conversation notification preference could not be updated. Please try again.",
        ),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    meta: { noGlobalError: true },
  });

  const setMuted = useCallback(
    (muted: boolean) => mutate({ chatId: ref.chatId, muted }),
    [mutate, ref.chatId],
  );

  return { setMuted, isPending };
};

export const useChatThreadMute = (
  ref: ChatRef,
  threadId: string,
): UseChatMuteResult => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const queryKey = chatKeys.notificationPreferencesOf(ref.accountId);
  const { mutate, isPending } = useMutation<
    void,
    Error,
    SetChatThreadMutedParams,
    ThreadMutationContext
  >({
    mutationFn: (params) =>
      getRegistry().get(ref.accountId).setChatThreadMuted(params),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey });
      const current =
        queryClient.getQueryData<ChatNotificationPreferencesByChat>(queryKey);
      const previous = getChatNotificationPreferences(current, params.chatId);
      const previousThread = previous.threads[params.threadId];
      queryClient.setQueryData<ChatNotificationPreferencesByChat>(
        queryKey,
        (cached) => patchThreadMuted(cached, params),
      );
      return {
        hadChat: current?.[params.chatId] !== undefined,
        hadThread: previousThread !== undefined,
        previousThread: previousThread ? { ...previousThread } : undefined,
      };
    },
    onError: (_error, { chatId, threadId: failedThreadId }, context) => {
      if (context) {
        queryClient.setQueryData<ChatNotificationPreferencesByChat>(
          queryKey,
          (cached) => {
            const current = cached ?? {};
            const preferences = getChatNotificationPreferences(current, chatId);
            const threads = { ...preferences.threads };
            if (context.hadThread && context.previousThread) {
              threads[failedThreadId] = { ...context.previousThread };
            } else {
              delete threads[failedThreadId];
            }
            const restored = {
              ...current,
              [chatId]: {
                room: { ...preferences.room },
                threads,
              },
            };
            return !context.hadChat && canRemoveDefaultChat(restored[chatId])
              ? withoutChat(restored, chatId)
              : restored;
          },
        );
      }
      notify.error(
        t(
          "The thread notification preference could not be updated. Please try again.",
        ),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    meta: { noGlobalError: true },
  });

  const setMuted = useCallback(
    (muted: boolean) => mutate({ chatId: ref.chatId, threadId, muted }),
    [mutate, ref.chatId, threadId],
  );

  return { setMuted, isPending };
};

export { patchRoomMuted, patchThreadMuted };
