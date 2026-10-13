import { useTranslation } from "react-i18next";
import {
  type ContextProp,
  type ItemProps,
  type ListProps,
  Virtuoso,
} from "react-virtuoso";

import type { ChatRef, ChatThread } from "@/features/drivers/types";

import { useChatThreads } from "../../hooks/useChatThreads";

import { ThreadListItem } from "./ThreadListItem";
import { ToolsPanelHeader } from "./ToolsPanelHeader";

type ThreadListProps = {
  chatRef: ChatRef;
  isOpen: boolean;
  onClose: () => void;
  onOpenThread: (threadId: string) => void;
};

type ThreadRowsContext = { count: number };

// Two-line preview plus the separator above it.
const DEFAULT_ROW_HEIGHT = 88;

// Virtuoso types its list refs as divs: list roles keep the semantics of the
// former <ul>, and the position attributes announce the full virtual length.
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
    aria-setsize={context.count}
  >
    {children}
  </div>
);

// Stable component types: Virtuoso remounts every row when they change.
const THREAD_LIST_COMPONENTS = { List: ThreadRows, Item: ThreadRow };

/** Threads panel list view — every thread of the active conversation. */
export const ThreadList = ({
  chatRef,
  isOpen,
  onClose,
  onOpenThread,
}: ThreadListProps) => {
  const { t } = useTranslation();
  const { threads, isInitialLoading, isError, refetch } =
    useChatThreads(chatRef);

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
      <div className="hub__chat-thread-list">
        <Virtuoso
          data={threads}
          context={{ count: threads.length }}
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
