import { Button } from "@gouvfr-lasuite/ui-components";
import {
  ArrowDropDown,
  Plus,
  QuestionMark,
} from "@gouvfr-lasuite/ui-components/icons";
import clsx from "clsx";
import type { TFunction } from "i18next";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  chatHref,
  readChatRef,
  readSpaceId,
  sameChatRef,
  spaceHref,
} from "@/features/chat/chatRefs";
import { compareChats } from "@/features/chat/chatSorting";
import { CreateSalonModal } from "@/features/chat/components/CreateSalonModal";
import { CreateSpaceModal } from "@/features/chat/components/CreateSpaceModal";
import { formatChatListTimestamp } from "@/features/chat/formatTimestamp";
import { useChatUnread } from "@/features/chat/hooks/useChatUnread";
import { useChats } from "@/features/chat/hooks/useChats";
import { useSpaces } from "@/features/chat/hooks/useSpaces";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { Chat, ChatUnread, Space } from "@/features/drivers/types";
import { AccountSelector } from "@/features/layouts/components/AccountSelector/AccountSelector";
import { Avatar } from "@/features/ui/components/avatar/Avatar";
import { ChatPresenceAvatar } from "@/features/ui/components/presence/ChatPresenceAvatar";
import { LanguagePickerUserMenu } from "@/features/ui/components/user-profile/LanguagePickerUserMenu";

import { TchapLogo } from "./TchapLogo";

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type ActionItem =
  | { id: string; href: string; icon: ReactNode; label: string }
  | {
      id: string;
      href?: undefined;
      icon: ReactNode;
      label: string;
      keyShortcuts?: string;
      onClick: () => void;
    };

type Tab = "all" | "unread" | "recent";

/** The row/menu-item second line: "You : ...", "{name} : ..." or the raw text. */
const formatPreview = (t: TFunction, chat: Chat): string | undefined => {
  if (!chat.preview) return undefined;
  if (chat.preview.isOwnMessage) return `${t("You")} : ${chat.preview.text}`;
  if (chat.preview.senderName)
    return `${chat.preview.senderName} : ${chat.preview.text}`;
  return chat.preview.text;
};

const filterChatsByTab = (
  chats: Chat[],
  tab: Tab,
  unreadLookup: (ref: Chat["ref"]) => ChatUnread,
): Chat[] => {
  switch (tab) {
    case "unread":
      return chats.filter((chat) => unreadLookup(chat.ref).unread);
    case "recent":
      return chats.filter(
        (chat) =>
          chat.lastActivityAt &&
          Date.now() - Date.parse(chat.lastActivityAt) <= RECENT_WINDOW_MS,
      );
    default:
      return chats;
  }
};

const buildTabs = (
  t: TFunction,
  unreadCount: number,
): { id: Tab; label: string }[] => [
  { id: "all", label: t("All") },
  {
    id: "unread",
    label: unreadCount > 0 ? `${t("Unread")} · ${unreadCount}` : t("Unread"),
  },
  { id: "recent", label: t("Recent") },
];

export const LeftPanel = ({ onSearch }: { onSearch: () => void }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { spaces } = useSpaces();
  const selectedSpaceId = readSpaceId(router.query);
  // Default to the first joined espace when none is selected in the URL, so
  // the switcher always has an active bubble once the account has any.
  const activeSpaceId = selectedSpaceId ?? spaces[0]?.id ?? null;

  // Direct messages are never space-scoped, so they need their own,
  // unfiltered query; rooms are scoped to whichever espace is active.
  const unscopedChats = useChats();
  const scopedChats = useChats(activeSpaceId ?? undefined);
  const unreadLookup = useChatUnread();
  const entries = useDriverEntries();
  const accountLabels = new Map(
    entries.map((entry) => [entry.accountId, entry.label]),
  );
  const showAccountLabels = entries.length > 1;
  const [tab, setTab] = useState<Tab>("all");
  const [isRoomsOpen, setIsRoomsOpen] = useState(true);
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [isSalonModalOpen, setIsSalonModalOpen] = useState(false);
  const roomsReactId = useId();
  const roomsTitleId = `${roomsReactId}-title`;
  const roomsPanelId = `${roomsReactId}-panel`;

  const directChats = useMemo(
    () =>
      [...unscopedChats.favourites, ...unscopedChats.all]
        .filter((chat) => chat.kind === "direct")
        .sort(compareChats),
    [unscopedChats.favourites, unscopedChats.all],
  );
  const groupChats = useMemo(
    () =>
      [...scopedChats.favourites, ...scopedChats.all]
        .filter((chat) => chat.kind === "group")
        .sort(compareChats),
    [scopedChats.favourites, scopedChats.all],
  );
  const unreadCount = useMemo(
    () => groupChats.filter((chat) => unreadLookup(chat.ref).unread).length,
    [groupChats, unreadLookup],
  );
  const visibleChats = useMemo(
    () => filterChatsByTab(groupChats, tab, unreadLookup),
    [tab, groupChats, unreadLookup],
  );

  const canCreateSalon = entries.some(
    ({ driver }) => driver.supportsConversationCreation,
  );
  const canCreateSpace = entries.some(
    ({ driver }) => driver.supportsSpaceCreation,
  );

  const actions: ActionItem[] = [];
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
      onClick: onSearch,
    });
  }

  const tabs = useMemo(() => buildTabs(t, unreadCount), [t, unreadCount]);

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

        <EspacesRow
          spaces={spaces}
          activeSpaceId={activeSpaceId}
          canCreateSpace={canCreateSpace}
          onCreateSpace={() => setIsSpaceModalOpen(true)}
        />
      </div>

      {/* Direct messages and Rooms used to each scroll internally (a small
          capped list, and a flex-grow list); they now share one scrollbar
          for the whole panel body, so long lists in either section scroll
          the same way instead of fighting each other for space. */}
      <div className="hub__left-panel__body">
        <DirectMessagesSection
          chats={directChats}
          unreadLookup={unreadLookup}
          accountLabels={accountLabels}
          showAccountLabels={showAccountLabels}
          spaceId={activeSpaceId}
        />

        <div className="hub__left-panel__section" data-open={isRoomsOpen}>
          <SectionHeader
            titleId={roomsTitleId}
            panelId={roomsPanelId}
            title={t("Rooms")}
            isOpen={isRoomsOpen}
            onToggle={() => setIsRoomsOpen((open) => !open)}
            addLabel={canCreateSalon ? t("New room") : undefined}
            onAdd={canCreateSalon ? () => setIsSalonModalOpen(true) : undefined}
          />

          {isRoomsOpen && <TabsRow tab={tab} tabs={tabs} onChange={setTab} />}

          {isRoomsOpen && (
            <div
              id={roomsPanelId}
              role="region"
              aria-labelledby={roomsTitleId}
              className="hub__left-panel__section__panel__inner"
            >
              <ul className="hub__left-panel__list">
                {visibleChats.map((chat) => (
                  <li key={`${chat.accountId}:${chat.id}`}>
                    <ChatRow
                      chat={chat}
                      accountLabel={accountLabels.get(chat.accountId)}
                      showAccountLabel={showAccountLabels}
                      unread={unreadLookup(chat.ref)}
                      spaceId={activeSpaceId}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="hub__left-panel__footer">
        <AccountSelector />
        <div className="hub__left-panel__footer__end">
          <Button
            variant="tertiary"
            color="neutral"
            icon={<QuestionMark size={24} />}
            aria-label={t("Help")}
          />
          <LanguagePickerUserMenu />
        </div>
      </div>

      <CreateSpaceModal
        isOpen={isSpaceModalOpen}
        onClose={() => setIsSpaceModalOpen(false)}
      />
      <CreateSalonModal
        isOpen={isSalonModalOpen}
        onClose={() => setIsSalonModalOpen(false)}
        spaces={spaces}
        defaultSpaceId={activeSpaceId}
      />
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

/**
 * Discord-style section header: title + chevron are one tight, content-sized
 * toggle button (not a full-width row) so a separate "+" button can sit on
 * the same line, flush to the right, to add straight into this section.
 */
const SectionHeader = ({
  titleId,
  panelId,
  title,
  count,
  isOpen,
  onToggle,
  addLabel,
  onAdd,
}: {
  titleId: string;
  panelId: string;
  title: string;
  count?: number;
  isOpen: boolean;
  onToggle: () => void;
  addLabel?: string;
  onAdd?: () => void;
}) => (
  <div className="hub__left-panel__section__header-row">
    <button
      type="button"
      id={titleId}
      className="hub__left-panel__section__header"
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={onToggle}
    >
      <span className="hub__left-panel__section__title">
        {title}
        {!!count && count > 0 && (
          <span className="hub__left-panel__section__count">{count}</span>
        )}
      </span>
      <ArrowDropDown
        aria-hidden="true"
        className="hub__left-panel__section__chevron"
      />
    </button>
    {onAdd && (
      <button
        type="button"
        className="hub__left-panel__section__add"
        aria-label={addLabel}
        title={addLabel}
        onClick={onAdd}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    )}
  </div>
);

const TabsRow = ({
  tab,
  tabs,
  onChange,
}: {
  tab: Tab;
  tabs: { id: Tab; label: string }[];
  onChange: (tab: Tab) => void;
}) => (
  <div className="hub__left-panel__tabs" role="tablist">
    {tabs.map((candidate) => (
      <button
        key={candidate.id}
        type="button"
        role="tab"
        aria-selected={tab === candidate.id}
        className={clsx(
          "hub__left-panel__tab",
          tab === candidate.id && "hub__left-panel__tab--active",
        )}
        onClick={() => onChange(candidate.id)}
      >
        {candidate.label}
      </button>
    ))}
  </div>
);

const ChatRow = ({
  chat,
  accountLabel,
  showAccountLabel,
  unread,
  spaceId,
}: {
  chat: Chat;
  accountLabel?: string;
  showAccountLabel: boolean;
  unread: ChatUnread;
  spaceId: string | null;
}) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isActive = sameChatRef(readChatRef(router.query), chat.ref);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const timestamp = chat.lastActivityAt
    ? formatChatListTimestamp(chat.lastActivityAt, locale)
    : null;
  const previewText = formatPreview(t, chat);

  return (
    <Link
      href={chatHref(chat.ref, spaceId)}
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
      <ChatPresenceAvatar chat={chat} />
      <span className="hub__left-panel__chat__body">
        <span className="hub__left-panel__chat__row">
          <span
            className={clsx(
              "hub__left-panel__chat__name",
              unread.unread && "hub__left-panel__chat__name--strong",
            )}
          >
            {chat.name}
            {showAccountLabel && accountLabel && (
              <span className="hub__left-panel__chat__account">
                {" "}
                · {accountLabel}
              </span>
            )}
          </span>
          {timestamp && (
            <span className="hub__left-panel__chat__time">{timestamp}</span>
          )}
        </span>
        <span className="hub__left-panel__chat__row">
          <span className="hub__left-panel__chat__preview">{previewText}</span>
          {unread.unread && unread.count > 0 && (
            <span className="hub__left-panel__chat__badge">{unread.count}</span>
          )}
        </span>
      </span>
      {unread.unread && (
        <span className="hub__visually-hidden">{t("Unread message")}</span>
      )}
    </Link>
  );
};

/**
 * Direct (1:1) conversations don't appear in the list below — they live here
 * instead, in their own collapsible section, so the tabs and list only ever
 * deal with groups. The whole header (title, count, chevron) is one plain,
 * borderless button — a hover background is the only affordance.
 */
const DirectMessagesSection = ({
  chats,
  unreadLookup,
  accountLabels,
  showAccountLabels,
  spaceId,
}: {
  chats: Chat[];
  unreadLookup: (ref: Chat["ref"]) => ChatUnread;
  accountLabels: Map<string, string>;
  showAccountLabels: boolean;
  spaceId: string | null;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const panelId = `${reactId}-panel`;
  const unreadCount = useMemo(
    () => chats.filter((chat) => unreadLookup(chat.ref).unread).length,
    [chats, unreadLookup],
  );
  const tabs = useMemo(() => buildTabs(t, unreadCount), [t, unreadCount]);
  const visibleChats = useMemo(
    () => filterChatsByTab(chats, tab, unreadLookup),
    [chats, tab, unreadLookup],
  );

  return (
    <div className="hub__left-panel__section" data-open={isOpen}>
      <SectionHeader
        titleId={titleId}
        panelId={panelId}
        title={t("Direct messages")}
        count={unreadCount}
        isOpen={isOpen}
        onToggle={() => setIsOpen((open) => !open)}
        addLabel={t("New chat")}
        onAdd={() => void router.push("/chat/new")}
      />
      <div
        id={panelId}
        role="region"
        aria-labelledby={titleId}
        className="hub__left-panel__section__panel"
        inert={!isOpen}
      >
        <div className="hub__left-panel__section__panel__inner">
          {chats.length > 0 && (
            <TabsRow tab={tab} tabs={tabs} onChange={setTab} />
          )}
          {visibleChats.length > 0 ? (
            <ul className="hub__left-panel__list">
              {visibleChats.map((chat) => (
                <li key={`${chat.accountId}:${chat.id}`}>
                  <ChatRow
                    chat={chat}
                    accountLabel={accountLabels.get(chat.accountId)}
                    showAccountLabel={showAccountLabels}
                    unread={unreadLookup(chat.ref)}
                    spaceId={spaceId}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="hub__left-panel__section__empty">
              {t("No direct messages yet")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Horizontal Espaces switcher: every espace shows its name above its bubble;
 * the active one is shown at full strength, the others greyed out and
 * clickable to switch.
 */
const EspacesRow = ({
  spaces,
  activeSpaceId,
  canCreateSpace,
  onCreateSpace,
}: {
  spaces: Space[];
  activeSpaceId: string | null;
  canCreateSpace: boolean;
  onCreateSpace: () => void;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const currentChatRef = readChatRef(router.query);

  if (spaces.length === 0 && !canCreateSpace) {
    return null;
  }

  return (
    <div className="hub__left-panel__spaces">
      <span className="hub__left-panel__spaces__title">{t("Spaces")}</span>
      {/* The "+" and its separator stay fixed and visible; only the espace
          bubbles themselves scroll horizontally underneath them. */}
      <div className="hub__left-panel__spaces__bar">
        <div className="hub__left-panel__spaces__row">
          {spaces.map((space) => {
            const isActive = space.id === activeSpaceId;
            return (
              <Link
                key={space.id}
                href={spaceHref(space.id, currentChatRef)}
                shallow
                aria-current={isActive ? "true" : undefined}
                aria-label={space.name}
                title={space.name}
                className={clsx(
                  "hub__left-panel__spaces__item",
                  isActive && "hub__left-panel__spaces__item--active",
                )}
              >
                <span className="hub__left-panel__spaces__name">
                  {space.name}
                </span>
                <Avatar label={space.name} decorative>
                  <span className="material-icons" aria-hidden="true">
                    {space.visual.kind === "icon"
                      ? space.visual.icon
                      : "workspaces"}
                  </span>
                </Avatar>
              </Link>
            );
          })}
        </div>
        {canCreateSpace && (
          <>
            {spaces.length > 0 && (
              <span
                className="hub__left-panel__spaces__separator"
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              className="hub__left-panel__spaces__add"
              aria-label={t("New space")}
              title={t("New space")}
              onClick={onCreateSpace}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
