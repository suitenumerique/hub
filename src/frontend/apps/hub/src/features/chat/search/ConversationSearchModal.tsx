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
import { MessageSearchResultRow } from "./MessageSearchResultRow";
import type { ConversationSearchStatus, MessageSearchStatus } from "./types";
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

    messageAccounts,
    messageStatuses,
    messagePartial,
    messageResults,
    messageTotal,
    messageLoading,
    messageFailed,
    loadMoreMessages,
  } = useConversationSearch();
  const heading = useId();
  const messageHeading = useId();

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

              {/* Messages section: same row style as "Select a chat" above,
                  separated by a divider — see MessageSearchSection.scss. */}
              <div className="hub__message-search-section">
                {messageResults.length > 0 && (
                  <div role="group" aria-labelledby={messageHeading}>
                    <h2
                      id={messageHeading}
                      className="hub__conversation-search__heading"
                    >
                      {t("Messages")}
                    </h2>
                    {messageResults.map((result) => {
                      const key = JSON.stringify([
                        result.chat.accountId,
                        result.chat.id,
                        result.eventId,
                      ]);
                      return (
                        <MessageSearchResultRow
                          key={key}
                          id={key}
                          result={result}
                          accountLabel={
                            messageAccounts.length > 1
                              ? result.accountLabel
                              : undefined
                          }
                          onSelect={() => open(result.chat)}
                        />
                      );
                    })}
                  </div>
                )}
                {messageResults.length < messageTotal && (
                  <QuickSearchItem
                    id="hub-search-more-messages"
                    onSelect={loadMoreMessages}
                  >
                    {t("Show more messages ({{shown}} of {{total}})", {
                      shown: messageResults.length,
                      total: messageTotal,
                    })}
                  </QuickSearchItem>
                )}
                <div
                  className="hub__conversation-search__status"
                  role="status"
                  aria-live="polite"
                >
                  <MessageSearchResultsMessage
                    hasResults={messageResults.length > 0}
                    failed={messageFailed}
                    loading={messageLoading}
                    partial={messagePartial}
                  />
                  {messageAccounts.map((entry, index) => (
                    <MessageSearchStatusHint
                      key={entry.accountId}
                      status={messageStatuses[index]}
                      label={
                        messageAccounts.length > 1 ? entry.label : undefined
                      }
                      onRetry={() => entry.driver.retryMessageSearch()}
                      onBackfillRoom={(roomId) =>
                        entry.driver.backfillMessageSearchRoom(roomId)
                      }
                    />
                  ))}
                </div>
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

// --- Message search UI helpers ---------------------------------------

const MessageSearchResultsMessage = ({
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
  if (failed) return t("Message search is unavailable. Please try again.");
  if (loading) return t("Searching messages…");
  if (partial) {
    return t("No matches yet. Message indexing is incomplete.");
  }
  return t("No messages found.");
};

const MessageSearchStatusHint = ({
  status,
  label,
  onRetry,
  onBackfillRoom,
}: {
  status: MessageSearchStatus;
  label?: string;
  onRetry: () => void;
  onBackfillRoom: (roomId: string) => void;
}) => {
  const { t } = useTranslation();
  const incomplete = status.roomsPending > 0;
  const paused = status.freshness !== "current";
  const retryable = paused || status.hasFailures;
  return (
    <>
      {(incomplete || paused) && (
        <p>
          {label && `${label} · `}
          {paused
            ? t("Message indexing paused. Results may be incomplete.")
            : t("Rooms indexed: {{backfilled}} / {{eligible}}", {
                backfilled: status.roomsBackfilled,
                eligible: status.roomsEligible,
              })}
          {status.hasFailures && <> {t("Some rooms could not be indexed.")}</>}
        </p>
      )}
      {status.pendingRooms.length > 0 && (
        <ul className="hub__conversation-search__pending-rooms">
          {status.pendingRooms.map((room) => (
            <li key={room.roomId}>
              <button
                type="button"
                className="hub__conversation-search__retry"
                disabled={room.status === "backfilling"}
                onClick={() => onBackfillRoom(room.roomId)}
              >
                {room.status === "backfilling"
                  ? t("Indexing {{roomName}}…", { roomName: room.roomName })
                  : t("Search further in {{roomName}}", {
                      roomName: room.roomName,
                    })}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!status.storageAvailable && (
        <p>
          {t(
            "Message search storage is unavailable. Indexing will restart when this page is reopened.",
          )}
        </p>
      )}
      {retryable && (
        <button
          type="button"
          className="hub__conversation-search__retry"
          onClick={onRetry}
        >
          {t("Retry indexing")}
        </button>
      )}
    </>
  );
};
