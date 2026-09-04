import {
  Modal,
  ModalSize,
  QuickSearch,
  QuickSearchGroup,
  QuickSearchItemTemplate,
  Spinner,
} from "@gouvfr-lasuite/ui-components";
import { ArrowRight } from "@gouvfr-lasuite/ui-components/icons";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { chatHref } from "@/features/chat/chatRefs";
import { useChatSearch } from "@/features/chat/hooks/useChatSearch";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type {
  Chat,
  ChatMember,
  ChatSearchResult,
} from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

type ChatSearchModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const ChatSearchAvatar = ({ chat }: { chat: Chat }) => {
  if (chat.visual.kind === "emoji") {
    return (
      <Avatar label={chat.name} variant="soft" decorative>
        {chat.visual.emoji}
      </Avatar>
    );
  }
  if (chat.visual.kind === "icon") {
    return (
      <Avatar label={chat.name} decorative>
        <span className="material-icons" aria-hidden="true">
          {chat.visual.icon}
        </span>
      </Avatar>
    );
  }
  return <Avatar label={chat.name} decorative />;
};

const memberSummary = (members: ChatMember[]): string =>
  members.map((member) => member.name).join(", ");

const useDelayedVisibility = (visible: boolean, delay: number): boolean => {
  const [delayedVisible, setDelayedVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDelayedVisible(false);
      return;
    }
    const timeout = window.setTimeout(() => setDelayedVisible(true), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, visible]);

  return delayedVisible;
};

type ChatSearchResultItemProps = {
  accountLabels: Map<string, string>;
  result: ChatSearchResult;
  showAccountLabels: boolean;
};

const ChatSearchResultItem = ({
  accountLabels,
  result,
  showAccountLabels,
}: ChatSearchResultItemProps) => {
  const { t } = useTranslation();
  const isIncomingInvitation = result.invitationDirection === "incoming";
  const actionLabel = isIncomingInvitation ? t("View invitation") : t("Open");
  const action = (
    <span className="hub__chat-search-result__action" aria-hidden="true">
      {actionLabel}
      <ArrowRight size={16} />
    </span>
  );

  const { chat, members } = result;
  const accountLabel = accountLabels.get(chat.accountId);
  const invitationLabel =
    result.searchSection === "invitation"
      ? isIncomingInvitation
        ? t("Invitation received")
        : t("Invitation sent")
      : undefined;
  const secondaryText = [
    memberSummary(members),
    invitationLabel,
    showAccountLabels ? accountLabel : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <QuickSearchItemTemplate
      left={
        <div className="hub__chat-search-result">
          <ChatSearchAvatar chat={chat} />
          <span className="hub__chat-search-result__body">
            <span className="hub__chat-search-result__name">{chat.name}</span>
            {secondaryText && (
              <span className="hub__chat-search-result__subtitle">
                {secondaryText}
              </span>
            )}
          </span>
        </div>
      }
      right={action}
    />
  );
};

export const ChatSearchModal = ({
  isOpen,
  onOpenChange,
}: ChatSearchModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const entries = useDriverEntries();
  const accountLabels = new Map(
    entries.map((entry) => [entry.accountId, entry.label]),
  );
  const showAccountLabels = entries.length > 1;
  const {
    conversations,
    normalizedQuery,
    isLoading,
    isIndexing,
    isError,
    indexStatus,
  } = useChatSearch(query);
  const joinedConversations = conversations.filter(
    (result) => result.searchSection === "joined",
  );
  const invitationConversations = conversations.filter(
    (result) => result.searchSection === "invitation",
  );
  const hasResults = conversations.length > 0;
  const showCatchingUp = useDelayedVisibility(
    indexStatus.phase === "loading" || indexStatus.phase === "catching-up",
    400,
  );
  const showInitialIndexing = indexStatus.phase === "indexing";
  const hasIndexError = indexStatus.phase === "error";

  useEffect(() => {
    if (isOpen) {
      entries.forEach((entry) => entry.driver.resumeChatSearchIndex());
    }
  }, [entries, isOpen]);

  const close = () => {
    setQuery("");
    onOpenChange(false);
  };

  const openConversation = (result: ChatSearchResult) => {
    close();
    void router.push(chatHref(result.chat.ref));
  };

  const getStateMessage = () => {
    if (!normalizedQuery) {
      return t("Search conversations.");
    }
    if (isLoading && !hasResults) {
      return t("Searching…");
    }
    if (isError && !hasResults) {
      return t("Search results could not be loaded. Please try again.");
    }
    if (!hasResults) {
      if (isIndexing) {
        return t(
          "Search indexing is still in progress. Results may be incomplete.",
        );
      }
      if (hasIndexError) {
        return t("No conversation is available in the local index yet.");
      }
      return t("No conversations found");
    }
    return null;
  };
  const stateMessage = getStateMessage();

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      closeOnClickOutside
      size={ModalSize.MEDIUM}
      title={t("Search")}
      aria-label={t("Search conversations")}
    >
      <div className="hub__chat-search-modal">
        <QuickSearch
          onFilter={setQuery}
          inputValue={query}
          loading={isLoading}
          label={t("Search conversations")}
          placeholder={t("Search conversations")}
        >
          <div className="hub__chat-search-modal__results">
            {(showInitialIndexing || showCatchingUp || hasIndexError) && (
              <div
                className="hub__chat-search-modal__index-status"
                data-error={hasIndexError || undefined}
                role="status"
                aria-live="polite"
              >
                {!hasIndexError && <Spinner size="md" />}
                <span>
                  {hasIndexError
                    ? t(
                        "Search indexing is incomplete and will resume automatically.",
                      )
                    : showInitialIndexing
                      ? t(
                          "Indexing search… {{indexed}}/{{total}} conversations. Results may be incomplete.",
                          {
                            indexed: indexStatus.indexedRooms,
                            total: indexStatus.totalRooms,
                          },
                        )
                      : t("Updating search…")}
                </span>
              </div>
            )}
            {joinedConversations.length > 0 && (
              <QuickSearchGroup
                group={{
                  groupName: t("Active conversations"),
                  elements: joinedConversations,
                }}
                onSelect={openConversation}
                renderElement={(result) => (
                  <ChatSearchResultItem
                    accountLabels={accountLabels}
                    result={result}
                    showAccountLabels={showAccountLabels}
                  />
                )}
              />
            )}
            {invitationConversations.length > 0 && (
              <QuickSearchGroup
                group={{
                  groupName: t("Pending invitations"),
                  elements: invitationConversations,
                }}
                onSelect={openConversation}
                renderElement={(result) => (
                  <ChatSearchResultItem
                    accountLabels={accountLabels}
                    result={result}
                    showAccountLabels={showAccountLabels}
                  />
                )}
              />
            )}
            {!hasResults && (
              <QuickSearchGroup
                group={{
                  groupName: t("Active conversations"),
                  elements: [],
                  emptyString: stateMessage ?? undefined,
                  showWhenEmpty: true,
                }}
                onSelect={openConversation}
                renderElement={(result) => (
                  <ChatSearchResultItem
                    accountLabels={accountLabels}
                    result={result}
                    showAccountLabels={showAccountLabels}
                  />
                )}
              />
            )}
            {hasResults && isError && (
              <div
                className="hub__chat-search-modal__partial-error"
                role="status"
              >
                {t("Some search results could not be loaded.")}
              </div>
            )}
          </div>
        </QuickSearch>
      </div>
    </Modal>
  );
};
