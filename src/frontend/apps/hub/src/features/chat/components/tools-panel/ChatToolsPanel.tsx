import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ChatRef } from "@/features/drivers/types";
import { GroupFilesTool } from "@/features/groups/components/GroupFilesTool";
import type { Group } from "@/features/groups/types";
import type {
  DraftThreadRoot,
  OpenThreadOptions,
  ThreadInitialMessage,
} from "../../ChatPanelContext";

import { ThreadsTool } from "./ThreadsTool";

export type ChatTool = "threads" | "files";

const CONTENT_SCROLLERS =
  "[data-virtuoso-scroller], .hub__chat-tools-panel__content";

type ChatToolsPanelProps = {
  /** Lets the resize handle name the panel it controls. */
  id: string;
  tool: ChatTool | null;
  isOpen: boolean;
  chatRef: ChatRef;
  /** The group of the conversation, for its files. */
  group: Group | null;
  /** Thread whose detail view is open, or `null` for the thread list. */
  threadId: string | null;
  /** Incremented whenever a Reply action requests focus in the composer. */
  threadComposerFocusSignal: number;
  /** Reply the open thread shows highlighted, if it was opened on one. */
  threadInitialMessage: ThreadInitialMessage | null;
  /** Root message for a not-yet-created thread draft. */
  draftThreadRoot: DraftThreadRoot | null;
  onClose: () => void;
  onOpenThread: (threadId: string, options?: OpenThreadOptions) => void;
  onCloseThread: () => void;
};

export const ChatToolsPanel = ({
  id,
  tool,
  isOpen,
  chatRef,
  group,
  threadId,
  threadComposerFocusSignal,
  threadInitialMessage,
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
      id={id}
      className="hub__chat-tools-panel"
      // Takes the focus when it opens over the conversation.
      tabIndex={-1}
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
        <GroupFilesTool group={group} isOpen={isOpen} onClose={onClose} />
      )}
      {tool === "threads" && (
        <ThreadsTool
          chatRef={chatRef}
          threadId={threadId}
          threadComposerFocusSignal={threadComposerFocusSignal}
          threadInitialMessage={threadInitialMessage}
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
