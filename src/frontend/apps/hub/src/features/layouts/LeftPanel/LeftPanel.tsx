import { Button } from "@gouvfr-lasuite/ui-components";
import { Plus, QuestionMark } from "@gouvfr-lasuite/ui-components/icons";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { chatHref, readChatRef, sameChatRef } from "@/features/chat/chatRefs";
import { ChatVisualAvatar } from "@/features/chat/components/ChatVisualAvatar";
import {
  type ChatUnreadLookup,
  useChatUnread,
} from "@/features/chat/hooks/useChatUnread";
import { useChats } from "@/features/chat/hooks/useChats";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { Chat, ChatUnread } from "@/features/drivers/types";
import { AccountSelector } from "@/features/layouts/components/AccountSelector/AccountSelector";

import { TchapLogo } from "./TchapLogo";

type ActionItem =
  | { id: string; href: string; icon: ReactNode; label: string }
  | {
      id: string;
      href?: undefined;
      icon: ReactNode;
      label: string;
      keyShortcuts?: string;
      shortcutLabel?: string;
      onClick: () => void;
    };

const CHAT_LIST_MARK = "hub:chat-list";

export const LeftPanel = ({ onSearch }: { onSearch: () => void }) => {
  const { t } = useTranslation();
  const chats = useChats();
  const unreadLookup = useChatUnread();
  const entries = useDriverEntries();
  const hasChats = chats.all.length > 0;

  useEffect(() => {
    // Startup measurement: when the first conversation list reaches the screen.
    if (hasChats && !performance.getEntriesByName(CHAT_LIST_MARK).length)
      performance.mark(CHAT_LIST_MARK);
  }, [hasChats]);
  const searchShortcut = /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
    ? "⌘K"
    : "Ctrl K";

  const accountLabels = new Map(
    entries.map((entry) => [entry.accountId, entry.label]),
  );
  const showAccountLabels = entries.length > 1;

  const actions: ActionItem[] = [
    {
      id: "new",
      href: "/chat/new",
      icon: <Plus size={16} />,
      label: t("New"),
    },
  ];
  if (entries.some(({ driver }) => driver.supportsConversationSearch)) {
    actions.push({
      id: "search",
      icon: (
        <span className="material-icons" aria-hidden="true">
          search
        </span>
      ),
      label: t("Search"),
      keyShortcuts: "Meta+K Control+K",
      shortcutLabel: searchShortcut,
      onClick: onSearch,
    });
  }

  return (
    <aside className="hub__left-panel" aria-label={t("Side panel")}>
      <div className="hub__left-panel__top">
        <div className="hub__left-panel__logo">
          <TchapLogo />
        </div>

        <nav
          className="hub__left-panel__actions"
          aria-label={t("Quick actions")}
        >
          {actions.map((action) => (
            <ActionRow key={action.id} action={action} />
          ))}
        </nav>
      </div>

      <div className="hub__left-panel__scroll">
        {chats.favourites.length > 0 ? (
          <ChatSection
            title={t("Favourites")}
            chats={chats.favourites}
            accountLabels={accountLabels}
            showAccountLabels={showAccountLabels}
            unreadLookup={unreadLookup}
          />
        ) : null}
        <ChatSection
          title={t("All chats")}
          chats={chats.all}
          showNewChat={
            !chats.isLoading && !chats.isError && chats.all.length === 0
          }
          accountLabels={accountLabels}
          showAccountLabels={showAccountLabels}
          unreadLookup={unreadLookup}
        />
      </div>

      <div className="hub__left-panel__footer">
        <AccountSelector />
        <Button
          variant="tertiary"
          color="neutral"
          icon={<QuestionMark size={24} />}
          aria-label={t("Help")}
        />
      </div>
    </aside>
  );
};

const ActionRow = ({ action }: { action: ActionItem }) => {
  const body = (
    <>
      <span className="hub__left-panel__action__icon" aria-hidden="true">
        {action.icon}
      </span>
      <span className="hub__left-panel__action__label">{action.label}</span>
      {"shortcutLabel" in action && action.shortcutLabel ? (
        <kbd className="hub__left-panel__action__shortcut" aria-hidden="true">
          {action.shortcutLabel}
        </kbd>
      ) : null}
    </>
  );

  if (action.href) {
    return (
      <Link href={action.href} className="hub__left-panel__action">
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="hub__left-panel__action"
      onClick={"onClick" in action ? action.onClick : undefined}
      aria-keyshortcuts={
        "keyShortcuts" in action ? action.keyShortcuts : undefined
      }
    >
      {body}
    </button>
  );
};

type ChatSectionProps = {
  title: string;
  chats: Chat[];
  showNewChat?: boolean;
  accountLabels: Map<string, string>;
  showAccountLabels: boolean;
  unreadLookup: ChatUnreadLookup;
};

const ChatSection = ({
  title,
  chats,
  showNewChat = false,
  accountLabels,
  showAccountLabels,
  unreadLookup,
}: ChatSectionProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const panelId = `${reactId}-panel`;

  return (
    <section className="hub__left-panel__section" data-open={isOpen}>
      <h2 className="hub__left-panel__section__heading">
        <button
          type="button"
          id={titleId}
          className="hub__left-panel__section__header"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className="hub__left-panel__section__title">{title}</span>
          <span
            className="hub__left-panel__section__chevron"
            aria-hidden="true"
          >
            <img src="/assets/chat-section-chevron.svg" alt="" />
          </span>
        </button>
      </h2>
      <div
        id={panelId}
        role="region"
        aria-labelledby={titleId}
        className="hub__left-panel__section__panel"
      >
        <ul className="hub__left-panel__list" inert={!isOpen}>
          {showNewChat && (
            <li>
              <Link
                href="/chat/new"
                aria-current={
                  router.pathname === "/chat/new" ? "page" : undefined
                }
                className={clsx(
                  "hub__left-panel__chat",
                  router.pathname === "/chat/new" &&
                    "hub__left-panel__chat--active",
                )}
              >
                <span
                  className="hub__left-panel__chat__dot"
                  aria-hidden="true"
                />
                <span className="hub__left-panel__chat__content">
                  <span
                    className="hub__left-panel__chat__new-avatar"
                    aria-hidden="true"
                  >
                    <Plus size={16} />
                  </span>
                  <span className="hub__left-panel__chat__name hub__left-panel__chat__name--strong">
                    {t("New chat")}
                  </span>
                </span>
              </Link>
            </li>
          )}
          {chats.map((chat) => (
            <li key={`${chat.accountId}:${chat.id}`}>
              <ChatRow
                chat={chat}
                accountLabel={accountLabels.get(chat.accountId)}
                showAccountLabel={showAccountLabels}
                unread={unreadLookup(chat.ref)}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const ChatRow = ({
  chat,
  accountLabel,
  showAccountLabel,
  unread,
}: {
  chat: Chat;
  accountLabel?: string;
  showAccountLabel: boolean;
  unread: ChatUnread;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const isActive = sameChatRef(readChatRef(router.query), chat.ref);

  return (
    <Link
      href={chatHref(chat.ref)}
      shallow
      aria-label={
        showAccountLabel && accountLabel
          ? `${chat.name} ${accountLabel}`
          : chat.name
      }
      aria-current={isActive ? "page" : undefined}
      className={clsx(
        "hub__left-panel__chat",
        isActive && "hub__left-panel__chat--active",
      )}
    >
      <span
        className={clsx(
          "hub__left-panel__chat__dot",
          unread.unread && "hub__left-panel__chat__dot--visible",
          unread.highlight && "hub__left-panel__chat__dot--highlight",
        )}
        aria-hidden="true"
      />
      <span className="hub__left-panel__chat__content">
        <ChatVisualAvatar chat={chat} />
        <span className="hub__left-panel__chat__text">
          <span
            className={clsx(
              "hub__left-panel__chat__name",
              (unread.unread || isActive) &&
                "hub__left-panel__chat__name--strong",
            )}
          >
            {chat.name}
          </span>
          {showAccountLabel && accountLabel && (
            <span className="hub__left-panel__chat__account">
              {accountLabel}
            </span>
          )}
        </span>
      </span>
      {unread.unread && (
        <span className="hub__visually-hidden">{t("Unread message")}</span>
      )}
    </Link>
  );
};
