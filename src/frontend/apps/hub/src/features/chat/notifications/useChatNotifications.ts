import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";

import { chatHref } from "../chatRefs";

import { NotificationSound } from "./NotificationSound";
import { NotificationPermission } from "./notificationPermission";

type NotificationSession = {
  sound: NotificationSound;
  permission: NotificationPermission;
  notifications: Map<Notification, ChatRef>;
  disposed: boolean;
};

const preview = (content: string): string => {
  const characters = Array.from(content.replace(/\s+/gu, " ").trim());
  return characters.length > 160
    ? `${characters.slice(0, 159).join("")}…`
    : characters.join("");
};

/** Play incoming activity; show a browser notification only without focus. */
export const useChatNotifications = (userId?: string): void => {
  const entries = useDriverEntries();
  const hasAccounts = entries.length > 0;
  const router = useRouter();
  const { t } = useTranslation();
  const latest = useRef({ router, t });
  useEffect(() => {
    latest.current = { router, t };
  }, [router, t]);

  const session = useRef<NotificationSession | null>(null);
  useEffect(() => {
    if (!userId || !hasAccounts) return;
    const current: NotificationSession = {
      sound: new NotificationSound(),
      permission: new NotificationPermission(),
      notifications: new Map(),
      disposed: false,
    };
    session.current = current;
    return () => {
      current.disposed = true;
      current.sound.dispose();
      current.permission.dispose();
      current.notifications.forEach((_ref, notification) =>
        notification.close(),
      );
      current.notifications.clear();
      session.current = null;
    };
  }, [userId, hasAccounts]);

  useEffect(() => {
    const current = session.current;
    if (!userId || !current) return;
    const accounts = new Set(entries.map(({ accountId }) => accountId));
    current.notifications.forEach((ref, notification) => {
      if (!accounts.has(ref.accountId)) {
        notification.close();
        current.notifications.delete(notification);
      }
    });

    let active = true;
    const unsubscribes = entries.map(({ accountId, driver }) =>
      driver.subscribeToEvents((event) => {
        if (
          !active ||
          current.disposed ||
          (event.type !== "message:received" &&
            event.type !== "invitation:received")
        )
          return;

        // Capture focus before a permission prompt can change it.
        const focused =
          document.visibilityState === "visible" && document.hasFocus();
        current.sound.play();
        try {
          if (
            !focused &&
            window.isSecureContext &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const { t } = latest.current;
            let body: string;
            if (event.type === "message:received") {
              body = preview(event.content);
            } else if (event.inviterName) {
              body = t("{{name}} invites you to join this conversation.", {
                name: event.inviterName,
              });
            } else {
              body = t("You have been invited to join this conversation.");
            }

            const ref: ChatRef = { accountId, chatId: event.chatId };
            const notification = new Notification(event.chatName, {
              body,
              icon: "/assets/favicon.png",
              silent: true,
            });
            current.notifications.set(notification, ref);
            notification.onclose = () =>
              current.notifications.delete(notification);
            notification.onclick = () => {
              if (
                !current.disposed &&
                current.notifications.has(notification)
              ) {
                window.focus();
                void latest.current.router.push(chatHref(ref)).catch(() => {});
              }
              notification.close();
              current.notifications.delete(notification);
            };
          }
        } catch {
          // Native notification failures must not interrupt incoming activity.
        }
        current.permission.request();
      }),
    );
    return () => {
      active = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [entries, userId]);
};
