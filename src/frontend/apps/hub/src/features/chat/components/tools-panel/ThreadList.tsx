import { useTranslation } from "react-i18next";
import {
  type ContextProp,
  type ItemProps,
  type ListProps,
  Virtuoso,
} from "react-virtuoso";

import type { ChatRef, ChatThread } from "@/features/drivers/types";

import { useChatThreads } from "../../hooks/useChatThreads";
import { useListEdgeReturn } from "../../hooks/useListEdgeReturn";

import { ThreadListItem } from "./ThreadListItem";
import { ToolsPanelHeader } from "./ToolsPanelHeader";

type ThreadListProps = {
  chatRef: ChatRef;
  isOpen: boolean;
  onClose: () => void;
  onOpenThread: (threadId: string) => void;
};

type ThreadRowsContext = {
  count: number;
  hasMore: boolean;
  isFetchingMore: boolean;
  isFetchMoreError: boolean;
  onRetry: () => void;
};

// Two-line preview plus the separator above it.
const DEFAULT_ROW_HEIGHT = 88;

// Virtuoso types its list refs as divs: list roles keep the semantics of the
// former <ul>, and the position attributes announce the full virtual length,
// unknown while older threads remain to load.
const ThreadRows = ({
  ref,
  style,
  children,
  "data-testid": testId,
}: ListProps & ContextProp<ThreadRowsContext>) => (
  <div
    ref={ref}
    role="list"
    className="hub__chat-tools-panel__list"
    style={style}
    data-testid={testId}
  >
    {children}
  </div>
);

const ThreadRow = ({
  children,
  style,
  "data-index": index,
  "data-item-index": itemIndex,
  "data-known-size": knownSize,
  context,
}: ItemProps<ChatThread> & ContextProp<ThreadRowsContext>) => (
  <div
    role="listitem"
    className="hub__chat-thread-list__row"
    style={style}
    data-index={index}
    data-item-index={itemIndex}
    data-known-size={knownSize}
    aria-posinset={index + 1}
    aria-setsize={context.hasMore ? -1 : context.count}
  >
    {children}
  </div>
);

const ThreadListFooter = ({ context }: ContextProp<ThreadRowsContext>) => {
  const { t } = useTranslation();
  if (context.isFetchingMore) {
    return (
      <p className="hub__chat-tools-panel__state" role="status">
        {t("Loading threads…")}
      </p>
    );
  }
  if (context.isFetchMoreError) {
    return (
      <div className="hub__chat-tools-panel__state" role="alert">
        <p>{t("Older threads could not be loaded.")}</p>
        <button
          type="button"
          className="hub__chat-tools-panel__state__retry"
          onClick={context.onRetry}
        >
          {t("Retry")}
        </button>
      </div>
    );
  }
  return null;
};

// Room for the panel header, which floats over the list.
const ThreadListHeader = () => (
  <div className="hub__chat-thread-list__top-spacer" />
);

// Stable component types: Virtuoso remounts every row when they change.
const THREAD_LIST_COMPONENTS = {
  Header: ThreadListHeader,
  List: ThreadRows,
  Item: ThreadRow,
  Footer: ThreadListFooter,
};

/**
 * Threads panel list view — the threads of the active conversation, older
 * ones loading as the list reaches its end.
 */
export const ThreadList = ({
  chatRef,
  isOpen,
  onClose,
  onOpenThread,
}: ThreadListProps) => {
  const { t } = useTranslation();
  const {
    threads,
    hasMore,
    isFetchingMore,
    isFetchMoreError,
    isInitialLoading,
    isError,
    refetch,
    fetchMore,
  } = useChatThreads(chatRef);
  // Coming back to the end asks again, after a failure too: Virtuoso
  // reports `endReached` only when the length changes.
  const bottomReturn = useListEdgeReturn(
    fetchMore,
    `${chatRef.accountId}:${chatRef.chatId}`,
  );

  const renderBody = () => {
    if (isInitialLoading) {
      return (
        <div className="hub__chat-tools-panel__content">
          <p className="hub__chat-tools-panel__state" role="status">
            {t("Loading threads…")}
          </p>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="hub__chat-tools-panel__content">
          <div className="hub__chat-tools-panel__state" role="alert">
            <p>{t("Threads could not be loaded.")}</p>
            <button
              type="button"
              className="hub__chat-tools-panel__state__retry"
              onClick={refetch}
            >
              {t("Retry")}
            </button>
          </div>
        </div>
      );
    }

    if (threads.length === 0) {
      return (
        <div className="hub__chat-tools-panel__content">
          <p className="hub__chat-tools-panel__empty">{t("No threads yet")}</p>
        </div>
      );
    }

    return (
      <div className="hub__chat-thread-list" {...bottomReturn.scrollHandlers}>
        <Virtuoso
          // The scroller is focusable: name it for keyboard users.
          aria-label={t("All threads")}
          data={threads}
          context={{
            count: threads.length,
            hasMore,
            isFetchingMore,
            isFetchMoreError,
            onRetry: fetchMore,
          }}
          endReached={() => fetchMore()}
          atBottomStateChange={bottomReturn.onEdgeChange}
          computeItemKey={(_index, thread) => thread.id}
          defaultItemHeight={DEFAULT_ROW_HEIGHT}
          increaseViewportBy={DEFAULT_ROW_HEIGHT * 3}
          components={THREAD_LIST_COMPONENTS}
          itemContent={(index, thread) => (
            <>
              {index > 0 && (
                <div
                  className="hub__chat-tools-panel__separator"
                  aria-hidden="true"
                />
              )}
              <ThreadListItem
                accountId={chatRef.accountId}
                thread={thread}
                onOpen={() => onOpenThread(thread.id)}
              />
            </>
          )}
        />
      </div>
    );
  };

  return (
    <>
      <ToolsPanelHeader
        title={t("All threads")}
        isOpen={isOpen}
        onClose={onClose}
      />
      {renderBody()}
    </>
  );
};
