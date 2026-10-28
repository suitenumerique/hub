import type { MenuItem } from "@gouvfr-lasuite/ui-components";
import {
  Hide,
  Show,
  Star,
  StarSlash,
} from "@gouvfr-lasuite/ui-components/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Chat, ChatUnread } from "@/features/drivers/types";

import { useChatFavourite } from "./useChatFavourite";
import { useChatReadState } from "./useChatReadState";

/**
 * The favourite and read state actions of a conversation, shared by the
 * conversation list (right click and "more" button) and the header menu.
 */
export const useChatQuickActions = (
  chat: Chat,
  unread: ChatUnread,
): MenuItem[] => {
  const { t } = useTranslation();
  const { setFavourite, isPending: isFavouritePending } = useChatFavourite(
    chat.ref,
  );
  const {
    markAsUnread,
    markAsRead,
    isPending: isReadStatePending,
  } = useChatReadState(chat.ref);
  const isFavourite = chat.section === "favourites";

  return useMemo<MenuItem[]>(
    () => [
      {
        id: "favourite",
        label: isFavourite
          ? t("Remove from favourites")
          : t("Add to favourites"),
        icon: isFavourite ? <StarSlash /> : <Star />,
        isDisabled: isFavouritePending,
        callback: () => setFavourite(!isFavourite),
      },
      {
        id: "read-state",
        label: unread.unread ? t("Mark as read") : t("Mark as unread"),
        icon: unread.unread ? <Show /> : <Hide />,
        isDisabled: isReadStatePending,
        callback: unread.unread ? markAsRead : markAsUnread,
      },
    ],
    [
      isFavourite,
      isFavouritePending,
      isReadStatePending,
      markAsRead,
      markAsUnread,
      setFavourite,
      t,
      unread.unread,
    ],
  );
};
