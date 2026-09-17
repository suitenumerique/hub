import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { chatKeys } from "../chatKeys";

type MeetingAction =
  | { kind: "end"; meetingId: string }
  | { kind: "extend"; meetingId: string; minutes: number }
  | { kind: "rename"; meetingId: string; title: string };

export type UseChatMeetingActionsResult = {
  /** Closes the meeting for every member (organizer only). */
  endMeeting: (meetingId: string) => Promise<void>;
  /** Adds time to the planned duration (organizer only). */
  extendMeeting: (meetingId: string, minutes: number) => Promise<void>;
  /** Renames the meeting for every member (organizer only). */
  renameMeeting: (meetingId: string, title: string) => Promise<void>;
  isPending: boolean;
};

/** Organizer actions on a meeting of a conversation. */
export const useChatMeetingActions = (
  ref: ChatRef | null,
): UseChatMeetingActionsResult => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { mutateAsync, isPending } = useMutation<void, Error, MeetingAction>({
    mutationFn: (action) => {
      if (!ref) {
        return Promise.reject(
          new Error("useChatMeetingActions requires a conversation."),
        );
      }
      const driver = getRegistry().get(ref.accountId);
      switch (action.kind) {
        case "end":
          return driver.endChatMeeting(ref.chatId, action.meetingId);
        case "extend":
          return driver.extendChatMeeting(
            ref.chatId,
            action.meetingId,
            action.minutes,
          );
        case "rename":
          return driver.renameChatMeeting(
            ref.chatId,
            action.meetingId,
            action.title,
          );
      }
    },
    onSuccess: () => {
      if (ref) {
        void queryClient.invalidateQueries({
          queryKey: chatKeys.meetings(ref),
        });
      }
    },
    onError: () => {
      notify.error(t("The meeting could not be updated. Please try again."));
    },
    meta: { noGlobalError: true },
  });

  return {
    endMeeting: (meetingId) => mutateAsync({ kind: "end", meetingId }),
    extendMeeting: (meetingId, minutes) =>
      mutateAsync({ kind: "extend", meetingId, minutes }),
    renameMeeting: (meetingId, title) =>
      mutateAsync({ kind: "rename", meetingId, title }),
    isPending,
  };
};
