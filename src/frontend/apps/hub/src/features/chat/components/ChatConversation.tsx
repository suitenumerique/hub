import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { ChatRef } from "@/features/drivers/types";

import type { ChatMessageJump } from "../ChatMessageJumpContext";

import { ChatVirtualList } from "./ChatVirtualList";
import { preloadEmojiPicker } from "./EmojiPickerPopover";

type ChatConversationProps = {
  chatRef: ChatRef;
  /** Receives the list's jump to a message, `null` once it is gone. */
  onMessageJumpChange: (jump: ChatMessageJump | null) => void;
  /** Called by the jump to the latest messages, to focus the composer. */
  onJumpToLatest: () => void;
};

export const ChatConversation = ({
  chatRef,
  onMessageJumpChange,
  onJumpToLatest,
}: ChatConversationProps) => {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  useEffect(() => {
    const preload = () => preloadEmojiPicker(language);

    if (typeof window.requestIdleCallback === "function") {
      const request = window.requestIdleCallback(preload, { timeout: 1500 });
      return () => window.cancelIdleCallback(request);
    }

    const timeout = window.setTimeout(preload, 250);
    return () => window.clearTimeout(timeout);
  }, [language]);

  return (
    <div className="hub__chat-conversation">
      <ChatVirtualList
        key={`${chatRef.accountId}:${chatRef.chatId}`}
        chatRef={chatRef}
        onMessageJumpChange={onMessageJumpChange}
        onJumpToLatest={onJumpToLatest}
      />
    </div>
  );
};
