import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { APIError } from "@/features/api/APIError";
import { fetchMeetingArchive } from "@/features/chat/api/meetings";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatMeeting, ChatRef } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

/** Hands a file to the browser as a download. */
const saveFile = (blob: Blob, fileName: string) => {
  const href = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
  // Some browsers read the link after the click handler returns.
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
};

export type UseMeetingArchiveResult = {
  /** Downloads the archive of a closed meeting of the conversation. */
  downloadArchive: (meeting: ChatMeeting) => Promise<void>;
  /** The meeting whose archive is being prepared, if any. */
  pendingMeetingId: string | null;
};

/**
 * The archive of a closed meeting: agenda, participants, documents,
 * transcript and call chat, as a ZIP file prepared by the Hub. The current
 * account proves it is a member of the conversation with an OpenID token.
 */
export const useMeetingArchive = (
  ref: ChatRef | null,
): UseMeetingArchiveResult => {
  const { t } = useTranslation();

  const { mutateAsync, isPending, variables } = useMutation<
    void,
    Error,
    ChatMeeting
  >({
    mutationFn: async (meeting) => {
      if (!ref) {
        throw new Error("useMeetingArchive requires a conversation.");
      }
      const openIdToken = await getRegistry()
        .get(ref.accountId)
        .getOpenIdToken();
      const { blob, fileName } = await fetchMeetingArchive(meeting.id, {
        openIdToken,
        documents: [
          ...(meeting.summary ? [meeting.summary] : []),
          ...meeting.documents,
        ],
      });
      saveFile(blob, fileName);
    },
    onError: (error) => {
      notify.error(
        error instanceof APIError && error.code === 404
          ? t("No archive is available for this meeting.")
          : error instanceof APIError && error.code === 409
            ? t("The archive is available once the meeting is closed.")
            : t("The archive could not be downloaded. Please try again."),
      );
    },
    meta: { noGlobalError: true },
  });

  return {
    downloadArchive: async (meeting) => {
      try {
        await mutateAsync(meeting);
      } catch {
        // The error is already shown.
      }
    },
    pendingMeetingId: isPending ? (variables?.id ?? null) : null,
  };
};
