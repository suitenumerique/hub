import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  getRegistry,
  useDriverEntries,
} from "@/features/drivers/DriverRegistry";
import type { RemoveChatFromHistoryResult } from "@/features/drivers/Driver";
import type {
  ChatRef,
  ChatSections,
  ChatUnread,
} from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { chatKeys } from "../chatKeys";

export type UseRemoveChatFromHistoryResult = {
  removeFromHistory: () => Promise<RemoveChatFromHistoryResult>;
  isPending: boolean;
  isSupported: boolean;
};

const withoutChat = (
  sections: ChatSections | undefined,
  chatId: string,
): ChatSections | undefined =>
  sections
    ? {
        favourites: sections.favourites.filter((chat) => chat.id !== chatId),
        all: sections.all.filter((chat) => chat.id !== chatId),
      }
    : sections;

/** Leaves a conversation and removes its history from the current account. */
export const useRemoveChatFromHistory = (
  ref: ChatRef,
): UseRemoveChatFromHistoryResult => {
  const queryClient = useQueryClient();
  const entries = useDriverEntries();
  const { t } = useTranslation();
  const isSupported = useMemo(
    () =>
      entries.find((entry) => entry.accountId === ref.accountId)?.driver
        .supportsConversationHistoryRemoval ?? false,
    [entries, ref.accountId],
  );

  const clearConversationCaches = () => {
    queryClient.setQueryData<ChatSections>(
      chatKeys.chatsOf(ref.accountId),
      (sections) => withoutChat(sections, ref.chatId),
    );
    queryClient.setQueryData<Record<string, ChatUnread>>(
      chatKeys.unreadOf(ref.accountId),
      (current) => {
        if (!current || !(ref.chatId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[ref.chatId];
        return next;
      },
    );
    queryClient.removeQueries({ queryKey: chatKeys.chat(ref) });
    queryClient.removeQueries({ queryKey: chatKeys.messages(ref) });
    queryClient.removeQueries({ queryKey: chatKeys.threads(ref) });
    queryClient.removeQueries({ queryKey: chatKeys.threadDetails(ref) });
    queryClient.removeQueries({ queryKey: chatKeys.members(ref) });
    void queryClient.invalidateQueries({
      queryKey: chatKeys.chatsOf(ref.accountId),
    });
    void queryClient.invalidateQueries({
      queryKey: chatKeys.chatForUsersOf(ref.accountId),
    });
  };

  const runRemoval = () =>
    getRegistry().get(ref.accountId).removeChatFromHistory(ref.chatId);

  function showRetryWarning(): void {
    notify.warning(
      t(
        "You left the conversation, but its history could not be removed from this account.",
      ),
      {
        actions: [
          {
            label: t("Try again"),
            onClick: retryRemoval,
          },
        ],
      },
    );
  }

  function retryRemoval(): void {
    void runRemoval()
      .then((result) => {
        clearConversationCaches();
        if (result.status === "left_only") {
          showRetryWarning();
          return;
        }
        notify.brand(t("Conversation history removed from this account."));
      })
      .catch(() => {
        showRetryWarning();
      });
  }

  const mutation = useMutation<RemoveChatFromHistoryResult, Error, void>({
    mutationFn: async () => {
      if (!isSupported) {
        throw new Error(
          "useRemoveChatFromHistory requires a compatible chat driver.",
        );
      }
      return runRemoval();
    },
    onSuccess: (result) => {
      clearConversationCaches();
      if (result.status === "left_only") {
        showRetryWarning();
      }
    },
    onError: () => {
      notify.error(t("The conversation could not be left. Please try again."));
    },
    meta: { noGlobalError: true },
  });

  const removeFromHistory = useCallback(
    () => mutation.mutateAsync(),
    [mutation],
  );

  return {
    removeFromHistory,
    isPending: mutation.isPending,
    isSupported,
  };
};
