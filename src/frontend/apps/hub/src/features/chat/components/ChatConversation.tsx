import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { ChatRef } from "@/features/drivers/types";

import { ChatVirtualList } from "./ChatVirtualList";
import { preloadEmojiPicker } from "./EmojiPickerPopover";
import type { UnreadMessagesBannerProps } from "./UnreadMessagesBanner";

type ChatConversationProps = {
  chatRef: ChatRef;
  onUnreadBannerChange: (
    chatKey: string,
    banner: UnreadMessagesBannerProps | null,
  ) => void;
};

export const ChatConversation = ({
  chatRef,
  onUnreadBannerChange,
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
        chatRef={chatRef}
        onUnreadBannerChange={onUnreadBannerChange}
      />
    </div>
  );
};
