import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ChatRef } from "@/features/drivers/types";
import type {
  DraftThreadRoot,
  OpenThreadOptions,
} from "../../ChatPanelContext";

import { DocumentsTool } from "./DocumentsTool";
import { ThreadsTool } from "./ThreadsTool";
import { ToolsPanelHeader } from "./ToolsPanelHeader";

export type ChatTool = "threads" | "files";

const CONTENT_SCROLLERS =
  "[data-virtuoso-scroller], .hub__chat-tools-panel__content";

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
  // The view whose content scrolled under the header, which then draws its
  // separator as the side panel does. Another view starts without it.
  const view = `${tool}:${threadId ?? ""}`;
  const [scrolledView, setScrolledView] = useState<string | null>(null);

  return (
    <aside
      className="hub__chat-tools-panel"
      aria-label={t("Tools panel")}
      aria-hidden={!isOpen}
      // A closed panel stays mounted: keep its content out of keyboard reach.
      inert={!isOpen}
      data-scrolled={scrolledView === view}
      onScrollCapture={(event) => {
        const target = event.target as HTMLElement;
        // Only the view's own scroller, not the thread composer's field.
        if (!target.matches(CONTENT_SCROLLERS)) return;
        setScrolledView(target.scrollTop > 0 ? view : null);
      }}
    >
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
