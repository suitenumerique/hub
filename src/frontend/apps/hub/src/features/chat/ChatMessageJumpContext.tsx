import { createContext, useContext } from "react";

export type ChatMessageJump = {
  /** Brings a message of the list into view and selects it. */
  jumpTo: (messageId: string) => Promise<void>;
  /**
   * Whether the list loads the messages around one it does not hold. A list
   * without it only jumps to the messages it holds.
   */
  loadsMissing: boolean;
};

const ChatMessageJumpContext = createContext<ChatMessageJump | null>(null);

/** Set by the message list a bubble is rendered in. */
export const ChatMessageJumpProvider = ChatMessageJumpContext.Provider;

export const useChatMessageJump = (): ChatMessageJump | null =>
  useContext(ChatMessageJumpContext);

// Frames a jump waits for the row of its message, a new window's included.
const FOCUS_MAX_FRAMES = 30;

/**
 * Gives the focus to the message a jump went to once its row is rendered.
 * The control that started the jump may be gone, a new window remounting the
 * list or the scroll unmounting its row, which would leave the focus on the
 * page. Returns a function that cancels it.
 */
export const focusJumpTarget = (
  getList: () => HTMLElement | null,
  messageId: string,
): (() => void) => {
  let frames = 0;
  const tryFocus = () => {
    const bubble = getList()?.querySelector<HTMLElement>(
      `.hub__chat-bubble[data-message-id="${CSS.escape(messageId)}"]`,
    );
    // Focusable once rendered as the highlighted message.
    bubble?.focus({ preventScroll: true });
    if (bubble && document.activeElement === bubble) {
      return;
    }
    if (++frames < FOCUS_MAX_FRAMES) {
      request = requestAnimationFrame(tryFocus);
    }
  };
  let request = requestAnimationFrame(tryFocus);
  return () => cancelAnimationFrame(request);
};
