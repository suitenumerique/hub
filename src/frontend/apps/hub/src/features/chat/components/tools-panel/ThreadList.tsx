import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import { useChatThreads } from "../../hooks/useChatThreads";

import { ThreadListItem } from "./ThreadListItem";
import { ToolsPanelHeader } from "./ToolsPanelHeader";

type ThreadListProps = {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenThread: (threadId: string) => void;
};

/** Threads panel list view — every thread of the active conversation. */
export const ThreadList = ({
  chatId,
  isOpen,
  onClose,
  onOpenThread,
}: ThreadListProps) => {
  const { t } = useTranslation();
  const { threads, isInitialLoading, isError, refetch } =
    useChatThreads(chatId);

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
      <div className="hub__chat-tools-panel__content">
        <ul className="hub__chat-tools-panel__list">
          {threads.map((thread, index) => (
            <Fragment key={thread.id}>
              {index > 0 && (
                <li
                  role="separator"
                  className="hub__chat-tools-panel__separator"
                  aria-hidden="true"
                />
              )}
              <ThreadListItem
                thread={thread}
                onOpen={() => onOpenThread(thread.id)}
              />
            </Fragment>
          ))}
        </ul>
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
