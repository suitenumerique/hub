import type { ChatRef } from "@/features/drivers/types";

import {
  type ComposerDraft,
  EMPTY_DRAFT,
  validateMentions,
} from "./composerDraft";

/**
 * The draft of each conversation and thread stays in this browser until it is
 * sent, so it survives a reload and closing the browser, as in Element. It is
 * stored as plain text, even for an encrypted conversation: logging out erases
 * every draft, and leaving a conversation erases its own.
 */
const STORAGE_PREFIX = "hubComposerDraft:";

export const threadDraftKey = (chatRef: ChatRef, threadId: string) =>
  `${chatRef.accountId}:${chatRef.chatId}:${threadId}`;

export const loadComposerDraft = (key: string): ComposerDraft => {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!stored) {
      return EMPTY_DRAFT;
    }
    const { text, mentions } = JSON.parse(stored) as ComposerDraft;
    return { text, mentions: validateMentions(mentions, text) };
  } catch {
    // An unreadable draft is no draft.
    return EMPTY_DRAFT;
  }
};

/** Nothing but whitespace is no draft: it leaves the store. */
export const saveComposerDraft = (key: string, draft: ComposerDraft) => {
  try {
    if (draft.text.trim()) {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(draft));
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    }
  } catch {
    // A full storage must not get in the way of typing.
  }
};

const removeDrafts = (matches: (storageKey: string) => boolean) => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX) && matches(key))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Unavailable storage holds nothing to remove.
  }
};

/** Forgets the drafts of a conversation and of its threads. */
export const removeChatDrafts = ({ accountId, chatId }: ChatRef) => {
  removeDrafts((key) => key.includes(`:${accountId}:${chatId}`));
};

/** Forgets every draft kept in this browser. */
export const clearComposerDrafts = () => {
  removeDrafts(() => true);
};
