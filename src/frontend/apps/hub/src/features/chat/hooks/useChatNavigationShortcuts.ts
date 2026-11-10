import { useRouter } from "next/router";
import { useRef } from "react";

import type { Chat, ChatRef } from "@/features/drivers/types";
import { useShortcut } from "@/features/shortcuts/useShortcut";

import { chatHref, readChatRef, sameChatRef } from "../chatRefs";

import type { ChatUnreadLookup } from "./useChatUnread";

/**
 * The chat `step` places away from the open one in `chats`, going round the
 * list, among those `matches` keeps. Without an open chat, the first from the
 * top going down, or from the bottom going up.
 */
export const findAdjacentChat = (
  chats: readonly Chat[],
  current: ChatRef | null,
  step: 1 | -1,
  matches: (chat: Chat) => boolean = () => true,
): Chat | undefined => {
  const count = chats.length;
  let start = chats.findIndex((chat) => sameChatRef(chat.ref, current));
  if (start === -1) {
    // Just outside the list, on the side the search starts from.
    start = step === 1 ? -1 : count;
  }
  for (let offset = 1; offset <= count; offset += 1) {
    const chat = chats[(((start + step * offset) % count) + count) % count];
    if (chat && !sameChatRef(chat.ref, current) && matches(chat)) {
      return chat;
    }
  }
  return undefined;
};

/**
 * Alt+↑/↓ open the previous or next chat of the side panel, and with Shift
 * the previous or next unread one, as in Element.
 */
export const useChatNavigationShortcuts = (
  sections: { favourites: Chat[]; all: Chat[] },
  unreadLookup: ChatUnreadLookup,
) => {
  const router = useRouter();
  // A held key repeats faster than the route changes: go on from the chat
  // being opened.
  const openingRef = useRef<ChatRef | null>(null);

  const open = (step: 1 | -1, unreadOnly: boolean) => {
    // In the order of the side panel, whose sections never share a chat.
    const chats = [...sections.favourites, ...sections.all];
    const current =
      openingRef.current ??
      (router.pathname === "/chat" ? readChatRef(router.query) : null);
    const target = findAdjacentChat(
      chats,
      current,
      step,
      unreadOnly ? (chat) => unreadLookup(chat.ref).unread : undefined,
    );
    if (!target) {
      return false;
    }
    openingRef.current = target.ref;
    void router
      .push(chatHref(target.ref), undefined, { shallow: true })
      .finally(() => {
        if (openingRef.current === target.ref) {
          openingRef.current = null;
        }
      });
  };

  useShortcut("previousChat", () => open(-1, false));
  useShortcut("nextChat", () => open(1, false));
  useShortcut("previousUnreadChat", () => open(-1, true));
  useShortcut("nextUnreadChat", () => open(1, true));
};
