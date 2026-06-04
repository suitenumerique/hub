import type { ParsedUrlQuery } from "querystring";

import type {
  AccountId,
  Chat,
  ChatRef,
  ChatSections,
  LocalChat,
  LocalChatSections,
} from "@/features/drivers/types";

export const decorateChat = (accountId: AccountId, chat: LocalChat): Chat => ({
  ...chat,
  accountId,
  ref: { accountId, chatId: chat.id },
});

export const decorateChatSections = (
  accountId: AccountId,
  sections: LocalChatSections,
): ChatSections => ({
  favourites: sections.favourites.map((chat) => decorateChat(accountId, chat)),
  all: sections.all.map((chat) => decorateChat(accountId, chat)),
});

export const sameChatRef = (
  a: ChatRef | null | undefined,
  b: ChatRef | null | undefined,
): boolean =>
  Boolean(a && b && a.accountId === b.accountId && a.chatId === b.chatId);

export const chatHref = (ref: ChatRef) => ({
  pathname: "/chat",
  query: {
    account: ref.accountId,
    chat: ref.chatId,
  },
});

export const readChatRef = (query: ParsedUrlQuery): ChatRef | null => {
  if (typeof query.account !== "string" || typeof query.chat !== "string") {
    return null;
  }
  return { accountId: query.account, chatId: query.chat };
};
