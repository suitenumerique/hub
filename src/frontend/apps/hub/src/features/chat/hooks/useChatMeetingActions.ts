import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { updateMeeting } from "@/features/chat/api/meetings";
import { saveMeetingTranscript } from "@/features/chat/api/meetingTranscripts";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { chatKeys } from "../chatKeys";

type MeetingAction =
  | { kind: "end"; meetingId: string; title: string }
  | { kind: "extend"; meetingId: string; minutes: number }
  | { kind: "rename"; meetingId: string; title: string };

export type UseChatMeetingActionsResult = {
  /**
   * Closes the meeting for every member, then saves its transcript in Docs and
   * adds it to the meeting documents (organizer only). `title` names the
   * transcript document.
   */
  endMeeting: (meetingId: string, title: string) => Promise<void>;
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

  const invalidate = () => {
    if (ref) {
      void queryClient.invalidateQueries({
        queryKey: chatKeys.meetings(ref),
      });
    }
  };

  /**
   * The meeting is already closed: a transcript that cannot be saved only
   * warns, it does not report the closing as failed.
   */
  const attachTranscript = async (
    chat: ChatRef,
    meetingId: string,
    title: string,
  ) => {
    try {
      const document = await saveMeetingTranscript(meetingId, title);
      if (!document) {
        return;
      }
      await getRegistry()
        .get(chat.accountId)
        .addChatMeetingDocument(chat.chatId, meetingId, document);
      invalidate();
      notify.brand(t("The transcript was saved in Docs."));
    } catch {
      notify.warning(
        t("The meeting is closed, but its transcript could not be saved."),
      );
    }
  };

  /**
   * The server closes the meeting from its planned end: keep its copy in
   * step. A meeting it does not know (created before) is simply skipped.
   */
  const syncWithServer = async (
    meetingId: string,
    change: Parameters<typeof updateMeeting>[1],
  ) => {
    try {
      await updateMeeting(meetingId, change);
    } catch {
      // The members already see the change; only the automatic closing may
      // come at the former time.
    }
  };

  const { mutateAsync, isPending } = useMutation<void, Error, MeetingAction>({
    mutationFn: async (action) => {
      if (!ref) {
        throw new Error("useChatMeetingActions requires a conversation.");
      }
      const driver = getRegistry().get(ref.accountId);
      switch (action.kind) {
        case "end":
          await driver.endChatMeeting(ref.chatId, action.meetingId);
          invalidate();
          await attachTranscript(ref, action.meetingId, action.title);
          return;
        case "extend":
          await driver.extendChatMeeting(
            ref.chatId,
            action.meetingId,
            action.minutes,
          );
          await syncWithServer(action.meetingId, {
            extendMinutes: action.minutes,
          });
          return;
        case "rename":
          await driver.renameChatMeeting(
            ref.chatId,
            action.meetingId,
            action.title,
          );
          await syncWithServer(action.meetingId, {
            title: action.title.trim(),
          });
          return;
      }
    },
    onSuccess: invalidate,
    onError: () => {
      notify.error(t("The meeting could not be updated. Please try again."));
    },
    meta: { noGlobalError: true },
  });

  return {
    endMeeting: (meetingId, title) =>
      mutateAsync({ kind: "end", meetingId, title }),
    extendMeeting: (meetingId, minutes) =>
      mutateAsync({ kind: "extend", meetingId, minutes }),
    renameMeeting: (meetingId, title) =>
      mutateAsync({ kind: "rename", meetingId, title }),
    isPending,
  };
};
