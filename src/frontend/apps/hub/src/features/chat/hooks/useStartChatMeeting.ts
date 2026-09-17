import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import { MeetingNotAllowedError } from "@/features/drivers/meetingErrors";
import type {
  ChatMeeting,
  ChatRef,
  StartMeetingOptions,
} from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { createMeetRoom } from "../api/meetRooms";
import { chatKeys } from "../chatKeys";

export type UseStartChatMeetingResult = {
  /**
   * Starts (or rejoins) the conversation's meeting, or schedules one when
   * `options.startsAt` is in the future, and resolves with it.
   */
  startMeeting: (options?: StartMeetingOptions) => Promise<ChatMeeting>;
  isPending: boolean;
};

/**
 * Starts or schedules a meeting for a conversation. A Meet room is only
 * created, through the Hub backend, when a new call is needed. The caller is
 * responsible for opening the resolved `url` — this hook only owns the Matrix
 * write and its cache invalidation.
 */
export const useStartChatMeeting = (
  ref: ChatRef | null,
): UseStartChatMeetingResult => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { mutateAsync, isPending } = useMutation<
    ChatMeeting,
    Error,
    StartMeetingOptions | undefined
  >({
    mutationFn: (options) => {
      if (!ref) {
        return Promise.reject(
          new Error("useStartChatMeeting requires a conversation."),
        );
      }
      return getRegistry()
        .get(ref.accountId)
        .startChatMeeting(
          ref.chatId,
          (schedule) =>
            createMeetRoom({
              ...schedule,
              chatId: ref.chatId,
              title: options?.title?.trim(),
              agenda: options?.agenda,
              attachments: options?.attachments,
            }),
          options,
        );
    },
    onSuccess: () => {
      if (ref) {
        void queryClient.invalidateQueries({
          queryKey: chatKeys.meetings(ref),
        });
      }
    },
    onError: (error) => {
      notify.error(
        error instanceof MeetingNotAllowedError
          ? t("Only the moderators of this conversation can start a meeting.")
          : t("The meeting could not be started. Please try again."),
      );
    },
    meta: { noGlobalError: true },
  });

  const startMeeting = useCallback(
    (options?: StartMeetingOptions) => mutateAsync(options),
    [mutateAsync],
  );

  return { startMeeting, isPending };
};
