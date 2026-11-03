import type { ChatRef } from "@/features/drivers/types";
import type {
  DraftThreadRoot,
  OpenThreadOptions,
  ThreadInitialMessage,
} from "../../ChatPanelContext";

import { DraftThreadDetail } from "./DraftThreadDetail";
import { ThreadDetail } from "./ThreadDetail";
import { ThreadList } from "./ThreadList";

type ThreadsToolProps = {
  chatRef: ChatRef;
  /** Thread whose detail view is open, or `null` for the thread list. */
  threadId: string | null;
  /** Incremented whenever a Reply action requests focus in the composer. */
  threadComposerFocusSignal: number;
  /** Reply the open thread shows highlighted, if it was opened on one. */
  threadInitialMessage: ThreadInitialMessage | null;
  /** Root message for a thread draft that has not been created yet. */
  draftThreadRoot: DraftThreadRoot | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenThread: (threadId: string, options?: OpenThreadOptions) => void;
  onCloseThread: () => void;
};

/**
 * Threads tool content. Swaps between the thread list and a single thread's
 * detail view depending on `threadId`; the navigation state itself is owned by
 * `ChatView` so it survives the panel close animation.
 */
export const ThreadsTool = ({
  chatRef,
  threadId,
  threadComposerFocusSignal,
  threadInitialMessage,
  draftThreadRoot,
  isOpen,
  onClose,
  onOpenThread,
  onCloseThread,
}: ThreadsToolProps) => {
  if (threadId !== null) {
    return (
      <ThreadDetail
        chatRef={chatRef}
        threadId={threadId}
        composerFocusSignal={threadComposerFocusSignal}
        initialMessage={threadInitialMessage}
        isOpen={isOpen}
        onClose={onClose}
        onBack={onCloseThread}
      />
    );
  }

  if (draftThreadRoot !== null) {
    return (
      <DraftThreadDetail
        chatRef={chatRef}
        root={draftThreadRoot}
        composerFocusSignal={threadComposerFocusSignal}
        isOpen={isOpen}
        onClose={onClose}
        onBack={onCloseThread}
        onCreated={onOpenThread}
      />
    );
  }

  return (
    <ThreadList
      chatRef={chatRef}
      isOpen={isOpen}
      onClose={onClose}
      onOpenThread={onOpenThread}
    />
  );
};
