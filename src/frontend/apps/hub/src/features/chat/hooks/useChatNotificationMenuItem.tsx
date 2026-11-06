import type { DropdownMenuOption } from "@gouvfr-lasuite/ui-components";
import { Bell, Mute } from "@gouvfr-lasuite/ui-components/icons";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { trackEvent } from "@/features/analytics/analytics";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type {
  Chat,
  ChatEffectiveNotificationLevel,
} from "@/features/drivers/types";

import { BellRing } from "../components/BellRing";

import { useChatNotificationLevel } from "./useChatNotificationLevel";

const LEVEL_ICONS: Record<ChatEffectiveNotificationLevel, ReactNode> = {
  all_messages: <BellRing size={16} />,
  mentions_and_following: <Bell size={16} />,
  mute: <Mute size={16} />,
};

/**
 * The "Notifications" entry of a conversation's dropdown menus, with its
 * submenu of levels. Not for the right click menu: `ContextMenu` has neither
 * submenus nor checks.
 */
export const useChatNotificationMenuItem = (chat: Chat): DropdownMenuOption => {
  const { t } = useTranslation();
  const entries = useDriverEntries();
  const { setLevel, isPending } = useChatNotificationLevel(chat.ref);
  const isSupported =
    entries.find((entry) => entry.accountId === chat.ref.accountId)?.driver
      .supportsNotificationLevels ?? false;
  const level = chat.notificationLevel;
  const effectiveLevel = chat.effectiveNotificationLevel;

  return useMemo<DropdownMenuOption>(() => {
    const levelOption = (
      option: ChatEffectiveNotificationLevel,
      label: string,
    ): DropdownMenuOption => ({
      id: option,
      label,
      icon: LEVEL_ICONS[option],
      testId: "hub-chat-notification-level",
      isChecked: option === level,
      callback:
        option === level
          ? undefined
          : () => {
              trackEvent("chat_notification_level_changed", {
                previous_level: level,
                level: option,
              });
              setLevel(option);
            },
    });
    return {
      id: "notifications",
      label: t("Notifications"),
      icon: LEVEL_ICONS[effectiveLevel ?? "mentions_and_following"],
      isDisabled: !isSupported || !level || isPending,
      children: [
        // Only while inherited: the Hub never goes back to it.
        ...(level === "default"
          ? [
              {
                id: "default",
                label: t("Default", {
                  description:
                    "Notification level of a conversation that follows the global setting",
                }),
                testId: "hub-chat-notification-level",
                isChecked: true,
              },
            ]
          : []),
        levelOption("all_messages", t("All messages")),
        levelOption("mentions_and_following", t("Mentions & following")),
        levelOption(
          "mute",
          t("Mute", {
            description:
              "Notification level of a conversation that never notifies",
          }),
        ),
      ],
    };
  }, [effectiveLevel, isPending, isSupported, level, setLevel, t]);
};
