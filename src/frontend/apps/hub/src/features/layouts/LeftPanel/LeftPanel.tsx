import {
  Button,
  ContextMenu,
  DropdownMenu,
  Tooltip,
  useDropdownMenu,
} from "@gouvfr-lasuite/ui-components";
import {
  More,
  Plus,
  QuestionMark,
  Zoom,
} from "@gouvfr-lasuite/ui-components/icons";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  memo,
  MouseEventHandler,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  type ContextProp,
  type ItemProps,
  type ListProps,
  Virtuoso,
} from "react-virtuoso";

import { isInvitationChat } from "@/features/chat/chatMembership";
import { chatHref, readChatRef, sameChatRef } from "@/features/chat/chatRefs";
import { ChatVisualAvatar } from "@/features/chat/components/ChatVisualAvatar";
import { useChatQuickActions } from "@/features/chat/hooks/useChatQuickActions";
import {
  type ChatUnreadLookup,
  useChatUnread,
} from "@/features/chat/hooks/useChatUnread";
import { useChats } from "@/features/chat/hooks/useChats";
import { APP_VERSION } from "@/features/config/appVersion";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { Chat, ChatRef, ChatUnread } from "@/features/drivers/types";
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

export const LeftPanel = ({ onSearch }: { onSearch: () => void }) => {
  const { t } = useTranslation();
  const chats = useChats();
  const unreadLookup = useChatUnread();
  const entries = useDriverEntries();
  // The rows render inside this element's scroll, only those near the view.
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);
  // Draws the separator under the top actions once the list scrolls under it.
  const [isScrolled, setIsScrolled] = useState(false);
  const searchShortcut = /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
    ? "⌘K"
    : "Ctrl K";

  const accountLabels = useMemo(
    () => new Map(entries.map((entry) => [entry.accountId, entry.label])),
    [entries],
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
      icon: <Zoom size={16} />,
      label: t("Search"),
      keyShortcuts: "Meta+K Control+K",
      shortcutLabel: searchShortcut,
      onClick: onSearch,
    });
  }

  return (
    <aside
      className="hub__left-panel"
      aria-label={t("Side panel")}
      data-scrolled={isScrolled}
    >
      <div
        className="hub__left-panel__scroll"
        ref={setScrollParent}
        onScroll={(event) => setIsScrolled(event.currentTarget.scrollTop > 0)}
      >
        {/* Sticky inside the scroll, so the rows pass under its blur. */}
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

        {chats.favourites.length > 0 ? (
          <ChatSection
            title={t("Favourites")}
            chats={chats.favourites}
            scrollParent={scrollParent}
            accountLabels={accountLabels}
            showAccountLabels={showAccountLabels}
            unreadLookup={unreadLookup}
          />
        ) : null}
        <ChatSection
          title={t("All chats")}
          chats={chats.all}
          scrollParent={scrollParent}
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
        {/* On the left: the panel clips what overflows its right edge. */}
        <Tooltip
          content={t("App Version {{version}}", { version: APP_VERSION })}
          placement="left"
          className="hub__delayed-tooltip hub__left-panel__help-tooltip"
        >
          <Button
            variant="tertiary"
            color="neutral"
            icon={<QuestionMark size={24} />}
            aria-label={t("Help")}
          />
        </Tooltip>
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
  scrollParent: HTMLElement | null;
  showNewChat?: boolean;
  accountLabels: Map<string, string>;
  showAccountLabels: boolean;
  unreadLookup: ChatUnreadLookup;
};

/** What every row reads, passed through Virtuoso's context. */
type ChatRowContext = {
  count: number;
  activeRef: ChatRef | null;
  accountLabels: Map<string, string>;
  showAccountLabels: boolean;
  unreadLookup: ChatUnreadLookup;
  onFocusedRowRemoved: () => void;
};

// Like Element's room list (VirtualizedRoomListView), only the rows near the
// view are rendered: each one holds two menus and their mutations, which made
// rendering every conversation slow on large accounts. As in ThreadList,
// Virtuoso types its list refs as divs: list roles keep the semantics of the
// former <ul>, and the position attributes announce the full length.
const ChatList = ({
  ref,
  style,
  children,
  "data-testid": testId,
}: ListProps & ContextProp<ChatRowContext>) => (
  <div
    ref={ref}
    role="list"
    style={style}
    data-testid={testId}
    className="hub__left-panel__list hub__left-panel__list--virtual"
  >
    {children}
  </div>
);

const ChatListItem = ({
  children,
  style,
  "data-index": index,
  "data-item-index": itemIndex,
  "data-known-size": knownSize,
  context,
}: ItemProps<Chat> & ContextProp<ChatRowContext>) => {
  const rowRef = useRef<HTMLDivElement>(null);
  // The row's link or "more" button while it has the focus.
  const focusedRef = useRef<HTMLElement | null>(null);
  const { onFocusedRowRemoved } = context;

  // When the list reorders (a message moves a conversation up), React moves
  // rows with insertBefore, which drops the focus of a moved one to the page
  // without a blur event: give it back. A blur the user caused forgets it.
  useLayoutEffect(() => {
    const focused = focusedRef.current;
    if (focused?.isConnected && document.activeElement === document.body)
      focused.focus({ preventScroll: true });
  });

  // A row leaving Virtuoso's range is removed. Layout cleanups run while it is
  // still in the document, so its focus can be seen before it is lost.
  useLayoutEffect(() => {
    const row = rowRef.current;
    return () => {
      if (row?.contains(document.activeElement)) onFocusedRowRemoved();
    };
  }, [onFocusedRowRemoved]);

  return (
    <div
      ref={rowRef}
      role="listitem"
      data-index={index}
      data-item-index={itemIndex}
      data-known-size={knownSize}
      aria-posinset={index + 1}
      aria-setsize={context.count}
      style={style}
      className="hub__left-panel__item"
      onFocus={(event) => {
        focusedRef.current = event.target;
      }}
      onBlur={() => {
        focusedRef.current = null;
      }}
    >
      {children}
    </div>
  );
};

// Stable component types: Virtuoso remounts every row when they change.
const CHAT_LIST_COMPONENTS = { List: ChatList, Item: ChatListItem };

// The avatar line and its padding, plus the space between rows (see
// `hub__left-panel__list--virtual`); an account label adds a second line.
// Known in advance, Virtuoso renders the rows at once instead of measuring a
// first one alone.
const ROW_HEIGHT = 42;
const ROW_HEIGHT_WITH_ACCOUNT = 51;

const chatRowKey = (_index: number, chat: Chat) =>
  `${chat.accountId}:${chat.id}`;

const renderChatRow = (_index: number, chat: Chat, context: ChatRowContext) => (
  <ChatRow
    chat={chat}
    accountLabel={context.accountLabels.get(chat.accountId)}
    showAccountLabel={context.showAccountLabels}
    unread={context.unreadLookup(chat.ref)}
    isActive={sameChatRef(context.activeRef, chat.ref)}
  />
);

// Rendering more than the view keeps keyboard navigation and fast scrolling
// from reaching rows that are not rendered yet.
const OVERSCAN = { top: 400, bottom: 800 };

const ChatSection = memo(function ChatSection({
  title,
  chats,
  scrollParent,
  showNewChat = false,
  accountLabels,
  showAccountLabels,
  unreadLookup,
}: ChatSectionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const panelId = `${reactId}-panel`;
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLButtonElement>(null);

  // Virtuoso reads a list's offset in the shared scroll parent again only on
  // scroll. When a section above grows or collapses, the lists below move
  // without a scroll and would render the wrong rows until the next one.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !scrollParent) return;
    const observer = new ResizeObserver(() => {
      scrollParent.dispatchEvent(new Event("scroll"));
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, [scrollParent]);

  // A removed row that had the focus gives it to the section header instead
  // of dropping it to the page, or to the first header left when its section
  // went away with it (its last favourite removed).
  const onFocusedRowRemoved = useCallback(() => {
    queueMicrotask(() => {
      if (document.activeElement && document.activeElement !== document.body)
        return;
      const header =
        headerRef.current ??
        document.querySelector<HTMLElement>(
          ".hub__left-panel__section__header",
        );
      header?.focus({ preventScroll: true });
    });
  }, []);

  // Primitives, so the rows' context only changes with the selection.
  const activeChatRef = readChatRef(router.query);
  const activeAccountId = activeChatRef?.accountId;
  const activeId = activeChatRef?.chatId;
  const rowContext = useMemo<ChatRowContext>(
    () => ({
      count: chats.length,
      activeRef:
        activeAccountId && activeId
          ? { accountId: activeAccountId, chatId: activeId }
          : null,
      accountLabels,
      showAccountLabels,
      unreadLookup,
      onFocusedRowRemoved,
    }),
    [
      chats.length,
      activeAccountId,
      activeId,
      accountLabels,
      showAccountLabels,
      unreadLookup,
      onFocusedRowRemoved,
    ],
  );

  return (
    <section
      ref={sectionRef}
      className="hub__left-panel__section"
      data-open={isOpen}
    >
      <h2 className="hub__left-panel__section__heading">
        <button
          ref={headerRef}
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
        {showNewChat ? (
          <ul className="hub__left-panel__list" inert={!isOpen}>
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
          </ul>
        ) : (
          <div className="hub__left-panel__list-viewport" inert={!isOpen}>
            {scrollParent && (
              <Virtuoso
                customScrollParent={scrollParent}
                data={chats}
                context={rowContext}
                computeItemKey={chatRowKey}
                components={CHAT_LIST_COMPONENTS}
                itemContent={renderChatRow}
                increaseViewportBy={OVERSCAN}
                defaultItemHeight={
                  showAccountLabels ? ROW_HEIGHT_WITH_ACCOUNT : ROW_HEIGHT
                }
                // Measure rows before paint, as ChatVirtualList does. This may
                // log benign "ResizeObserver loop" errors.
                skipAnimationFrameInResizeObserver
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
});

type ChatRowProps = {
  chat: Chat;
  accountLabel?: string;
  showAccountLabel: boolean;
  unread: ChatUnread;
  isActive: boolean;
};

/**
 * A pending invitation has no quick access menu, as in the header. Memoized:
 * a list update re-renders only the rows whose conversation, read state or
 * selection changed.
 */
const ChatRow = memo(function ChatRow(props: ChatRowProps) {
  return isInvitationChat(props.chat) ? (
    <ChatRowLink {...props} />
  ) : (
    <ChatRowWithMenus {...props} />
  );
});

/**
 * Opens the quick access menu on right click or from the "more" button shown
 * while the row is hovered or focused.
 */
const ChatRowWithMenus = (props: ChatRowProps) => {
  const { chat, unread } = props;
  const { t } = useTranslation();
  const options = useChatQuickActions(chat, unread);
  const menu = useDropdownMenu();
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  return (
    <>
      <ContextMenu
        options={options}
        asChild
        onFocus={() => setIsContextMenuOpen(true)}
        onBlur={() => setIsContextMenuOpen(false)}
      >
        <ChatRowLink {...props} isMenuOpen={isContextMenuOpen || menu.isOpen} />
      </ContextMenu>
      <div className="hub__left-panel__chat__more">
        <DropdownMenu options={options} {...menu} onOpenChange={menu.setIsOpen}>
          <Button
            type="button"
            variant="tertiary"
            color="neutral"
            size="nano"
            className="hub__left-panel__chat__more-button"
            aria-label={t("More options for {{name}}", { name: chat.name })}
            aria-haspopup="menu"
            aria-expanded={menu.isOpen}
            icon={<More size={16} />}
            onClick={() => menu.setIsOpen((open) => !open)}
          />
        </DropdownMenu>
      </div>
    </>
  );
};

const ChatRowLink = ({
  chat,
  accountLabel,
  showAccountLabel,
  unread,
  isActive,
  isMenuOpen = false,
  onContextMenu,
}: ChatRowProps & {
  isMenuOpen?: boolean;
  /** Set by the `ContextMenu` it is the child of. */
  onContextMenu?: MouseEventHandler<HTMLAnchorElement>;
}) => {
  const { t } = useTranslation();

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
        isMenuOpen && "hub__left-panel__chat--menu-open",
      )}
      onContextMenu={onContextMenu}
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
