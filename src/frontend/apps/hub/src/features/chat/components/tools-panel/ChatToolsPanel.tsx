import { useTranslation } from "react-i18next";

import type { ChatRef } from "@/features/drivers/types";
import type {
  DraftThreadRoot,
  OpenThreadOptions,
} from "../../ChatPanelContext";

import { DocumentsTool } from "./DocumentsTool";
import { MeetingsTool } from "./MeetingsTool";
import { ThreadsTool } from "./ThreadsTool";
import { ToolsPanelHeader } from "./ToolsPanelHeader";

export type ChatTool = "meetings" | "threads" | "files";

type ChatToolsPanelProps = {
  tool: ChatTool | null;
  isOpen: boolean;
  chatRef: ChatRef;
  /** Thread whose detail view is open, or `null` for the thread list. */
  threadId: string | null;
  /** Incremented whenever a Reply action requests focus in the composer. */
  threadComposerFocusSignal: number;
  /** Root message for a not-yet-created thread draft. */
  draftThreadRoot: DraftThreadRoot | null;
  onClose: () => void;
  onOpenThread: (threadId: string, options?: OpenThreadOptions) => void;
  onCloseThread: () => void;
};

export const ChatToolsPanel = ({
  tool,
  isOpen,
  chatRef,
  threadId,
  threadComposerFocusSignal,
  draftThreadRoot,
  onClose,
  onOpenThread,
  onCloseThread,
}: ChatToolsPanelProps) => {
  const { t } = useTranslation();

  return (
    <aside
      className="hub__chat-tools-panel"
      aria-label={t("Tools panel")}
      aria-hidden={!isOpen}
    >
      {tool === "meetings" && (
        <MeetingsTool chatRef={chatRef} isOpen={isOpen} onClose={onClose} />
      )}
      {tool === "files" && (
        <>
          <ToolsPanelHeader
            title={t("Documents")}
            isOpen={isOpen}
            onClose={onClose}
          />
          <DocumentsTool />
        </>
      )}
      {tool === "threads" && (
        <ThreadsTool
          chatRef={chatRef}
          threadId={threadId}
          threadComposerFocusSignal={threadComposerFocusSignal}
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
