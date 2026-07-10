import {
  ArrowDropDown,
  GearRounded,
  Meet,
  Plus,
  QuestionMark,
  Zoom,
} from "@gouvfr-lasuite/ui-kit/icons";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { chatHref, readChatRef, sameChatRef } from "@/features/chat/chatRefs";
import { useChatScopes } from "@/features/chat/hooks/useChatAccounts";
import {
  type ChatUnreadLookup,
  useChatUnread,
} from "@/features/chat/hooks/useChatUnread";
import { useChats } from "@/features/chat/hooks/useChats";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type {
  Chat,
  ChatRef,
  ChatScope,
  ChatUnread,
} from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

type ActionItem =
  | { id: string; href: string; icon: ReactNode; label: string }
  | { id: string; href?: undefined; icon: ReactNode; label: string };

export const LeftPanel = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const chats = useChats();
  const unreadLookup = useChatUnread();
  const { activeScopeId, scopes, setActiveScopeId } = useChatScopes();
  const entries = useDriverEntries();
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
    {
      id: "meeting",
      icon: <Meet size={16} />,
      label: t("Start a meeting"),
    },
    {
      id: "search",
      icon: <Zoom size={16} />,
      label: t("Search"),
    },
  ];

  return (
    <aside className="hub__left-panel" aria-label={t("Side panel")}>
      <div className="hub__left-panel__top">
        <div className="hub__left-panel__logo">
          <Image
            src="/assets/logo_text.svg"
            alt={t("LaSuite Hub")}
            width={168}
            height={40}
            priority
            unoptimized
          />
        </div>

        {scopes.length > 1 && activeScopeId && (
          <ScopeSelector
            activeScopeId={activeScopeId}
            scopes={scopes}
            currentChatRef={readChatRef(router.query)}
            onChangeScope={(scopeId) => {
              const nextScope = scopes.find(
                (scope) => scope.scopeId === scopeId,
              );
              const currentChatRef = readChatRef(router.query);
              const currentAccountStillActive =
                !currentChatRef ||
                nextScope?.accounts.some(
                  (account) => account.accountId === currentChatRef.accountId,
                );

              if (currentAccountStillActive) {
                setActiveScopeId(scopeId);
                return;
              }

              void router
                .push("/chat/new", undefined, { shallow: true })
                .then(() => setActiveScopeId(scopeId));
            }}
          />
        )}

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
          accountLabels={accountLabels}
          showAccountLabels={showAccountLabels}
          unreadLookup={unreadLookup}
        />
      </div>

      <div className="hub__left-panel__footer">
        <button
          type="button"
          className="hub__left-panel__icon-button"
          aria-label={t("Help")}
        >
          <QuestionMark size={16} />
        </button>
        <button
          type="button"
          className="hub__left-panel__icon-button"
          aria-label={t("Settings")}
        >
          <GearRounded size={16} />
        </button>
      </div>
    </aside>
  );
};

type ScopeSelectorProps = {
  activeScopeId: string;
  scopes: ChatScope[];
  currentChatRef: ChatRef | null;
  onChangeScope: (scopeId: string) => void;
};

const ScopeSelector = ({
  activeScopeId,
  scopes,
  currentChatRef,
  onChangeScope,
}: ScopeSelectorProps) => {
  const { t } = useTranslation();
  const currentScopeContainsChat = scopes
    .find((scope) => scope.scopeId === activeScopeId)
    ?.accounts.some(
      (account) => account.accountId === currentChatRef?.accountId,
    );

  return (
    <div className="hub__left-panel__scope">
      <select
        className="hub__left-panel__scope__select"
        aria-label={t("Chat scope")}
        value={activeScopeId}
        onChange={(event) => onChangeScope(event.target.value)}
      >
        {scopes.map((scope) => (
          <option key={scope.scopeId} value={scope.scopeId}>
            {scope.label}
          </option>
        ))}
      </select>
      <ArrowDropDown
        className="hub__left-panel__scope__icon"
        aria-hidden="true"
      />
      {currentChatRef && currentScopeContainsChat === false && (
        <span className="hub__visually-hidden">
          {t("The selected chat is outside the active scope.")}
        </span>
      )}
    </div>
  );
};

const ActionRow = ({ action }: { action: ActionItem }) => {
  const body = (
    <>
      <span className="hub__left-panel__action__icon" aria-hidden="true">
        {action.icon}
      </span>
      <span className="hub__left-panel__action__label">{action.label}</span>
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
    <button type="button" className="hub__left-panel__action">
      {body}
    </button>
  );
};

type ChatSectionProps = {
  title: string;
  chats: Chat[];
  accountLabels: Map<string, string>;
  showAccountLabels: boolean;
  unreadLookup: ChatUnreadLookup;
};

const ChatSection = ({
  title,
  chats,
  accountLabels,
  showAccountLabels,
  unreadLookup,
}: ChatSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);
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
          <ArrowDropDown />
        </button>
      </h2>
      <div
        id={panelId}
        role="region"
        aria-labelledby={titleId}
        className="hub__left-panel__section__panel"
      >
        <ul className="hub__left-panel__list" inert={!isOpen}>
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
      {chat.visual.kind === "emoji" ? (
        <Avatar label={chat.name} variant="soft" decorative>
          {chat.visual.emoji}
        </Avatar>
      ) : chat.visual.kind === "icon" ? (
        <Avatar label={chat.name} decorative>
          <span className="material-icons" aria-hidden="true">
            {chat.visual.icon}
          </span>
        </Avatar>
      ) : (
        <Avatar label={chat.name} decorative />
      )}
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
          <span className="hub__left-panel__chat__account">{accountLabel}</span>
        )}
      </span>
      {unread.unread && (
        <span className="hub__visually-hidden">{t("Unread message")}</span>
      )}
    </Link>
  );
};
