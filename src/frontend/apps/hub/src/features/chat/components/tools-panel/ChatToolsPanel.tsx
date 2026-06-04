import { useTranslation } from "react-i18next";

import type { ChatDocument, ChatRef } from "@/features/drivers/types";
import type {
  DraftThreadRoot,
  OpenThreadOptions,
} from "../../ChatPanelContext";

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
  /** Whether a freshly opened thread detail should focus its composer. */
  focusThreadComposer: boolean;
  /** Root message for a not-yet-created thread draft. */
  draftThreadRoot: DraftThreadRoot | null;
  onClose: () => void;
  onOpenThread: (threadId: string, options?: OpenThreadOptions) => void;
  onCloseThread: () => void;
  onOpenFile?: (doc: ChatDocument) => void;
};

export const ChatToolsPanel = ({
  tool,
  isOpen,
  chatRef,
  threadId,
  focusThreadComposer,
  draftThreadRoot,
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
          focusThreadComposer={focusThreadComposer}
          draftThreadRoot={draftThreadRoot}
          isOpen={isOpen}
          onClose={onClose}
          onOpenThread={onOpenThread}
          onCloseThread={onCloseThread}
        />
      )}
    </aside>
  );
};
