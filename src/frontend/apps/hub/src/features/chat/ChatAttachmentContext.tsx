import dynamic from "next/dynamic";
import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useContext,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatAttachment, ChatRef } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";
import { saveAttachment } from "./hooks/useChatAttachmentMedia";

const ChatFilePreview = dynamic(
  () =>
    import("./components/ChatFilePreview").then(
      (module) => module.ChatFilePreview,
    ),
  { ssr: false },
);

const ChatAttachmentContext = createContext<{
  openFile: (ref: ChatRef, attachment: ChatAttachment) => void;
  downloadFile: (ref: ChatRef, attachment: ChatAttachment) => Promise<void>;
}>({ openFile: () => {}, downloadFile: async () => {} });

export const useChatAttachmentActions = () => useContext(ChatAttachmentContext);

export const ChatAttachmentProvider = ({
  children,
  scope,
}: {
  children: ReactNode;
  scope?: string | null;
}) => {
  const { t } = useTranslation();
  const [opened, setOpened] = useState<{
    ref: ChatRef;
    attachment: ChatAttachment;
  }>();
  useEffect(() => setOpened(undefined), [scope]);
  const openFile = useCallback(
    (ref: ChatRef, attachment: ChatAttachment) =>
      setOpened({ ref, attachment }),
    [],
  );
  const downloadFile = useCallback(
    async (ref: ChatRef, attachment: ChatAttachment) => {
      try {
        const blob = await getRegistry()
          .get(ref.accountId)
          .getChatAttachment(attachment);
        saveAttachment(blob, attachment.name);
      } catch {
        notify.error(t("This file could not be downloaded. Please try again."));
      }
    },
    [t],
  );
  return (
    <ChatAttachmentContext.Provider value={{ openFile, downloadFile }}>
      {children}
      {opened && (
        <ChatFilePreview
          key={`${opened.ref.accountId}:${opened.attachment.url}`}
          attachment={opened.attachment}
          chatRef={opened.ref}
          onClose={() => setOpened(undefined)}
        />
      )}
    </ChatAttachmentContext.Provider>
  );
};
