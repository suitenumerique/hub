import { useTranslation } from "react-i18next";

import type { ChatDocument, ChatRef } from "@/features/drivers/types";

import { DocumentsTool } from "./DocumentsTool";
import { ThreadsTool } from "./ThreadsTool";
import { ToolsPanelHeader } from "./ToolsPanelHeader";

export type ChatTool = "threads" | "files";

type ChatToolsPanelProps = {
  tool: ChatTool | null;
  isOpen: boolean;
  chatRef: ChatRef;
  /** Thread whose detail view is open, or `null` for the thread list. */
  threadId: string | null;
  onClose: () => void;
  onOpenThread: (threadId: string) => void;
  onCloseThread: () => void;
  onOpenFile?: (doc: ChatDocument) => void;
};

export const ChatToolsPanel = ({
  tool,
  isOpen,
  chatRef,
  threadId,
  onClose,
  onOpenThread,
  onCloseThread,
  onOpenFile,
}: ChatToolsPanelProps) => {
  const { t } = useTranslation();

  return (
    <aside
      className="hub__chat-tools-panel"
      aria-label={t("Tools panel")}
      aria-hidden={!isOpen}
    >
      {tool === "files" && (
        <>
          <ToolsPanelHeader
            title={t("Documents")}
            isOpen={isOpen}
            onClose={onClose}
          />
          <DocumentsTool chatRef={chatRef} onOpenFile={onOpenFile} />
        </>
      )}
      {tool === "threads" && (
        <ThreadsTool
          chatRef={chatRef}
          threadId={threadId}
          isOpen={isOpen}
          onClose={onClose}
          onOpenThread={onOpenThread}
          onCloseThread={onCloseThread}
        />
      )}
    </aside>
  );
};
