import type { MenuItem } from "@gouvfr-lasuite/ui-components";
import {
  Hide,
  Show,
  Star,
  StarSlash,
} from "@gouvfr-lasuite/ui-components/icons";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { type EventProperty, trackEvent } from "@/features/analytics/analytics";
import type { Chat, ChatUnread } from "@/features/drivers/types";

import { useChatFavourite } from "./useChatFavourite";
import { useChatReadState } from "./useChatReadState";

/**
 * The favourite and read state actions of a conversation, shared by the
 * conversation list (right click and "more" button) and the header menu. Each
 * of those asks for its own items: the action is measured with where it came
 * from.
 */
export const useChatQuickActions = (
  chat: Chat,
  unread: ChatUnread,
): ((trigger: EventProperty<"chat:action-used", "trigger">) => MenuItem[]) => {
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

  return useCallback(
    (trigger) => [
      {
        id: "favourite",
        label: isFavourite
          ? t("Remove from favourites")
          : t("Add to favourites"),
        icon: isFavourite ? <StarSlash size={16} /> : <Star size={16} />,
        isDisabled: isFavouritePending,
        callback: () => {
          trackEvent("chat:action-used", {
            action: isFavourite ? "favourite_remove" : "favourite_add",
            trigger,
          });
          setFavourite(!isFavourite);
        },
      },
      {
        id: "read-state",
        label: unread.unread ? t("Mark as read") : t("Mark as unread"),
        icon: unread.unread ? <Show size={16} /> : <Hide size={16} />,
        isDisabled: isReadStatePending,
        callback: () => {
          trackEvent("chat:action-used", {
            action: unread.unread ? "mark_read" : "mark_unread",
            trigger,
          });
          if (unread.unread) {
            markAsRead();
          } else {
            markAsUnread();
          }
        },
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
