import { ThreadDetail } from "./ThreadDetail";
import { ThreadList } from "./ThreadList";

type ThreadsToolProps = {
  chatId: string;
  /** Thread whose detail view is open, or `null` for the thread list. */
  threadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenThread: (threadId: string) => void;
  onCloseThread: () => void;
};

/**
 * Threads tool content. Swaps between the thread list and a single thread's
 * detail view depending on `threadId`; the navigation state itself is owned by
 * `ChatView` so it survives the panel close animation.
 */
export const ThreadsTool = ({
  chatId,
  threadId,
  isOpen,
  onClose,
  onOpenThread,
  onCloseThread,
}: ThreadsToolProps) => {
  if (threadId !== null) {
    return (
      <ThreadDetail
        chatId={chatId}
        threadId={threadId}
        isOpen={isOpen}
        onClose={onClose}
        onBack={onCloseThread}
      />
    );
  }

  return (
    <ThreadList
      chatId={chatId}
      isOpen={isOpen}
      onClose={onClose}
      onOpenThread={onOpenThread}
    />
  );
};
