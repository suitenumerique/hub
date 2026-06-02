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

import { ALL_CHATS, FAVOURITE_CHATS } from "@/features/drivers/mocks/mockChats";
import type { Chat } from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

type ActionItem =
  | { id: string; href: string; icon: ReactNode; label: string }
  | { id: string; href?: undefined; icon: ReactNode; label: string };

export const LeftPanel = () => {
  const { t } = useTranslation();

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

      <nav className="hub__left-panel__actions" aria-label={t("Quick actions")}>
        {actions.map((action) => (
          <ActionRow key={action.id} action={action} />
        ))}
      </nav>

      <ChatSection title={t("Favourites")} chats={FAVOURITE_CHATS} />
      <ChatSection title={t("All chats")} chats={ALL_CHATS} />

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
};

const ChatSection = ({ title, chats }: ChatSectionProps) => {
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
            <li key={chat.id}>
              <ChatRow chat={chat} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const ChatRow = ({ chat }: { chat: Chat }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const isActive = router.query.chatId === chat.id;

  return (
    <Link
      href={`/chat/${chat.id}`}
      shallow
      aria-current={isActive ? "page" : undefined}
      className={clsx(
        "hub__left-panel__chat",
        isActive && "hub__left-panel__chat--active",
      )}
    >
      <span
        className={clsx(
          "hub__left-panel__chat__dot",
          chat.unread && "hub__left-panel__chat__dot--visible",
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
      <span
        className={clsx(
          "hub__left-panel__chat__name",
          (chat.unread || isActive) && "hub__left-panel__chat__name--strong",
        )}
      >
        {chat.name}
      </span>
      {chat.unread && (
        <span className="hub__visually-hidden">{t("Unread message")}</span>
      )}
    </Link>
  );
};
