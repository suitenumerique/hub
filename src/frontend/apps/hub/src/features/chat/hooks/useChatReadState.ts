import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef, ChatUnread } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { chatKeys } from "../chatKeys";

export type UseChatReadStateResult = {
  /** Shows the conversation unread until the user reads it again. */
  markAsUnread: () => void;
  /** Clears the flag and reads every message and thread. */
  markAsRead: () => void;
  isPending: boolean;
};

/**
 * The "Mark as unread" / "Mark as read" actions of the conversation menus.
 * Only marking unread is optimistic: reading clears several sources of unread
 * state, and patching the dot before the last one would make it flicker when
 * the others report back. Each of them emits `unread:changed`.
 */
export const useChatReadState = (ref: ChatRef): UseChatReadStateResult => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { mutate: mutateMarkUnread, isPending: isMarkingUnread } = useMutation<
    void,
    Error,
    void
  >({
    mutationFn: () =>
      getRegistry().get(ref.accountId).setChatMarkedUnread(ref.chatId, true),
    onMutate: async () => {
      const unreadKey = chatKeys.unreadOf(ref.accountId);
      await queryClient.cancelQueries({ queryKey: unreadKey });
      queryClient.setQueryData<Record<string, ChatUnread>>(
        unreadKey,
        (current) =>
          current && {
            ...current,
            [ref.chatId]: {
              highlight: current[ref.chatId]?.highlight ?? false,
              unread: true,
              markedUnread: true,
            },
          },
      );
    },
    onError: () => {
      // A live `unread:changed` may have landed meanwhile: read the state
      // again rather than restoring the one before the request.
      void queryClient.invalidateQueries({
        queryKey: chatKeys.unreadOf(ref.accountId),
      });
      notify.error(
        t("The conversation could not be marked as unread. Please try again."),
      );
    },
    meta: { noGlobalError: true },
  });

  const { mutate: mutateMarkRead, isPending: isMarkingRead } = useMutation<
    void,
    Error,
    void
  >({
    mutationFn: async () => {
      const driver = getRegistry().get(ref.accountId);
      await Promise.all([
        driver.setChatMarkedUnread(ref.chatId, false),
        driver.markChatRead(ref.chatId),
      ]);
    },
    onError: () => {
      notify.error(
        t("The conversation could not be marked as read. Please try again."),
      );
    },
    meta: { noGlobalError: true },
  });

  const markAsUnread = useCallback(
    () => mutateMarkUnread(),
    [mutateMarkUnread],
  );
  const markAsRead = useCallback(() => mutateMarkRead(), [mutateMarkRead]);

  return {
    markAsUnread,
    markAsRead,
    isPending: isMarkingUnread || isMarkingRead,
  };
};
