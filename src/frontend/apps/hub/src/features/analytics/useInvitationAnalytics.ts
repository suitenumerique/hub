import { useEffect } from "react";

import { isInvitationChat } from "@/features/chat/chatMembership";
import type { AccountId, ChatSections } from "@/features/drivers/types";

import {
  chatTypeOf,
  isAnalyticsEnabled,
  readAnalyticsStorage,
  trackEvent,
  writeAnalyticsStorage,
} from "./analytics";

const RECEIVED_STORAGE_NAME = "invitations-received";
/** Far more than anyone keeps pending; the oldest ones leave first. */
const MAXIMUM_REMEMBERED_INVITATIONS = 500;

const loadReceived = (): string[] => {
  try {
    const stored = readAnalyticsStorage(RECEIVED_STORAGE_NAME);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
};

/**
 * Reports each invitation the first time it shows up in the conversation list.
 * Every load lists the pending invitations again, so the ones already reported
 * are remembered on this browser. One leaving the list is not forgotten, only
 * past the limit: a list read before the sync ends would make it new again.
 */
export const useInvitationAnalytics = (
  byAccount: Map<AccountId, ChatSections>,
): void => {
  useEffect(() => {
    if (!isAnalyticsEnabled()) return;
    const received = loadReceived();
    const known = new Set(received);
    const added: string[] = [];
    byAccount.forEach((sections, accountId) => {
      [...sections.favourites, ...sections.all]
        .filter(isInvitationChat)
        .forEach((chat) => {
          const key = `${accountId}/${chat.ref.chatId}`;
          if (known.has(key)) return;
          known.add(key);
          added.push(key);
          trackEvent("invitation:received", { chat_type: chatTypeOf(chat) });
        });
    });
    if (added.length === 0) return;
    writeAnalyticsStorage(
      RECEIVED_STORAGE_NAME,
      JSON.stringify(
        [...received, ...added].slice(-MAXIMUM_REMEMBERED_INVITATIONS),
      ),
    );
  }, [byAccount]);
};
