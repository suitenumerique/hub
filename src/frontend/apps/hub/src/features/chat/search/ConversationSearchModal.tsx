import {
  Modal,
  ModalSize,
  QuickSearch,
  QuickSearchItem,
} from "@gouvfr-lasuite/ui-components";
import { useRouter } from "next/router";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import type { Chat } from "@/features/drivers/types";

import { chatHref } from "../chatRefs";

import { ConversationSearchResultRow } from "./ConversationSearchResultRow";
import type { ConversationSearchStatus } from "./types";
import { useConversationSearch } from "./useConversationSearch";

export const ConversationSearchModal = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    query,
    changeQuery,
    loadMore,
    hasQuery,
    accounts,
    statuses,
    partial,
    results,
    total,
    loading,
    failed,
  } = useConversationSearch();
  const heading = useId();

  const open = (chat: Chat) => {
    onClose();
    void router.push(chatHref(chat.ref), undefined, { shallow: true });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size={ModalSize.SMALL}
      title={t("Search")}
      titleVariant="compact"
      closeOnClickOutside
    >
      <div className="hub__conversation-search">
        <QuickSearch
          inputValue={query}
          onFilter={changeQuery}
          placeholder={t("Search chats")}
          label={t("Search chats")}
        >
          {hasQuery ? (
            <>
              {results.length > 0 && (
                <div role="group" aria-labelledby={heading}>
                  <h2
                    id={heading}
                    className="hub__conversation-search__heading"
                  >
                    {t("Select a chat")}
                  </h2>
                  {/* QuickSearchGroup uses array indices for selection values.
                      Compose its item primitive with stable account/room keys
                      so live indexing and pagination cannot open another row. */}
                  {results.map(({ chat, subtitle, accountLabel }) => {
                    const key = JSON.stringify([chat.accountId, chat.id]);
                    return (
                      <ConversationSearchResultRow
                        key={key}
                        id={key}
                        chat={chat}
                        subtitle={subtitle}
                        accountLabel={
                          accounts.length > 1 ? accountLabel : undefined
                        }
                        onSelect={() => open(chat)}
                      />
                    );
                  })}
                </div>
              )}
              {results.length < total && (
                <QuickSearchItem id="hub-search-more" onSelect={loadMore}>
                  {t("Show more chats ({{shown}} of {{total}})", {
                    shown: results.length,
                    total,
                  })}
                </QuickSearchItem>
              )}
              <div
                className="hub__conversation-search__status"
                role="status"
                aria-live="polite"
              >
                <SearchResultsMessage
                  hasResults={results.length > 0}
                  failed={failed}
                  loading={loading}
                  partial={partial}
                />
                {accounts.map((entry, index) => (
                  <SearchStatus
                    key={entry.accountId}
                    status={statuses[index]}
                    label={accounts.length > 1 ? entry.label : undefined}
                    onRetry={() => entry.driver.retryConversationSearch()}
                  />
                ))}
              </div>
            </>
          ) : null}
        </QuickSearch>
      </div>
    </Modal>
  );
};

const SearchResultsMessage = ({
  hasResults,
  failed,
  loading,
  partial,
}: {
  hasResults: boolean;
  failed: boolean;
  loading: boolean;
  partial: boolean;
}) => {
  const { t } = useTranslation();
  if (hasResults) return null;
  if (failed) return t("Search is unavailable. Please try again.");
  if (loading) return t("Searching…");
  if (partial) {
    return t("No matches yet. Conversation preparation is incomplete.");
  }
  return t("No chats found.");
};

const SearchStatus = ({
  status,
  label,
  onRetry,
}: {
  status: ConversationSearchStatus;
  label?: string;
  onRetry: () => void;
}) => {
  const { t } = useTranslation();
  const incomplete = status.ready < status.eligible || status.hasUnknownRooms;
  const paused = status.freshness !== "current";
  const retryable =
    paused ||
    status.hasFailures ||
    status.hasDeferredRooms ||
    status.hasUnknownRooms;
  return (
    <>
      {(incomplete || paused || status.hasNameOnlyRooms) && (
        <p>
          {label && `${label} · `}
          {paused
            ? t("Preparation paused. Results may be incomplete or outdated.")
            : t("Participants ready: {{ready}} / {{eligible}}", {
                ready: status.ready,
                eligible: status.eligible,
              })}
          {status.hasNameOnlyRooms && (
            <> {t("Large chats are searched by name only.")}</>
          )}
          {status.hasUnknownRooms && (
            <> {t("Waiting for conversation details.")}</>
          )}
          {status.hasFailures && (
            <> {t("Some conversations could not be prepared.")}</>
          )}
          {status.hasDeferredRooms && (
            <> {t("Some conversations are awaiting retry.")}</>
          )}
        </p>
      )}
      {!status.storageAvailable && (
        <p>
          {t(
            "Search storage is unavailable. Preparation will restart when this page is reopened.",
          )}
        </p>
      )}
      {retryable && (
        <button
          type="button"
          className="hub__conversation-search__retry"
          onClick={onRetry}
        >
          {t("Retry preparation")}
        </button>
      )}
    </>
  );
};
