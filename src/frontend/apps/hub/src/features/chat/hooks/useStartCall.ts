import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getHubApi } from "@/features/config/HubApi";
import type { Call, ChatRef } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { chatKeys } from "../chatKeys";

import { useSendChatMessage } from "./useSendChatMessage";

export type UseStartCallResult = {
  startCall: () => void;
  isStarting: boolean;
};

/**
 * Starts a call in a conversation and opens it in a new tab. The conversation
 * is told about the call only when this request opened it: joining a call that
 * is already ongoing must not announce it a second time.
 */
export const useStartCall = (ref: ChatRef | null): UseStartCallResult => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { sendCall } = useSendChatMessage(ref);

  const { mutate, isPending } = useMutation<Call, Error, Window | null>({
    mutationFn: async (tab) => {
      if (!ref) {
        throw new Error("Starting a call requires a chat.");
      }
      const { call, created } = await getHubApi().startCall(ref.chatId);
      queryClient.setQueryData(chatKeys.call(call.id), call);
      void queryClient.invalidateQueries({
        queryKey: chatKeys.ongoingCallsAll(),
      });
      if (tab) {
        tab.opener = null;
        tab.location.href = call.url;
      } else {
        window.open(call.url, "_blank", "noopener");
      }
      if (created) {
        await sendCall(
          { id: call.id, url: call.url },
          t("Meeting started: {{url}}", { url: call.url }),
        );
      }
      return call;
    },
    onError: (_error, tab) => {
      tab?.close();
      notify.error(t("The meeting could not be started."));
    },
    meta: { noGlobalError: true },
  });

  const startCall = useCallback(() => {
    // Opened within the click, before any request, so that browsers do not
    // block the tab as a pop-up.
    mutate(window.open("", "_blank"));
  }, [mutate]);

  return { startCall, isStarting: isPending };
};
