import { useRouter } from "next/router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { TchapLogoMark } from "@/features/layouts/LeftPanel/TchapLogo";

import { useReportActiveChat } from "../ActiveChatContext";
import { useComposerAccountId } from "../hooks/useChatAccounts";
import { useChatSecurity } from "../hooks/useChatSecurity";
import { useHasNoChats } from "../hooks/useChats";
import { isDeviceUnverified, useIsChatLocked } from "../hooks/useIsChatLocked";

import { MessageUnlock } from "./unlock/MessageUnlock";

/**
 * `/chat` without a conversation: where the Hub opens. Someone without any
 * conversation starts with a new one instead.
 */
export const ChatHome = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const accountId = useComposerAccountId();
  const { security } = useChatSecurity(accountId);
  // Nothing to hide here: it also says what to do before unlocking.
  const isLocked =
    useIsChatLocked(null, accountId) || isDeviceUnverified(security);
  // The welcome never shows just before the unlock card.
  const isChecking =
    security.supported && security.trust === "checking" && !security.issue;
  const hasNoChats = useHasNoChats();
  useReportActiveChat(null);

  useEffect(() => {
    if (hasNoChats) {
      void router.replace("/chat/new");
    }
  }, [hasNoChats, router]);

  if (hasNoChats || isChecking) {
    return null;
  }

  if (isLocked && accountId) {
    return <MessageUnlock accountId={accountId} />;
  }

  return (
    <div className="hub__chat-home">
      <TchapLogoMark className="hub__chat-home__mark" />
      <h1>{t("Welcome to LaSuite Tchap")}</h1>
      <p>{t("Choose a chat to start.")}</p>
    </div>
  );
};
