import { useRouter } from "next/router";
import { useEffect } from "react";

import { readChatRef } from "@/features/chat/chatRefs";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import { HubLayout } from "@/features/layouts/HubLayout";
import type { NextPageWithLayout } from "@/features/layouts/NextPageWithLayout";

import { ChatSurface } from "./ChatSurface";

/**
 * Shared page component for both `/chat/new` and `/chat` (an existing
 * conversation, addressed by the `?account=&chat=` query). Rendering a single
 * `<ChatSurface>` for both routes — instead of swapping between a new-chat view
 * and a conversation view — keeps that surface (and its virtualized message
 * list) mounted across the transition, so committing the URL when the user
 * sends the first message to an existing conversation is seamless.
 */
const ChatRoute: NextPageWithLayout = () => {
  const router = useRouter();
  const entries = useDriverEntries();
  const isNew = router.pathname === "/chat/new";
  const urlChatRef = router.isReady ? readChatRef(router.query) : null;
  const hasKnownAccount = Boolean(
    urlChatRef &&
    entries.some((entry) => entry.accountId === urlChatRef.accountId),
  );
  const mustRedirect = router.isReady && !isNew && !hasKnownAccount;

  useEffect(() => {
    if (mustRedirect) {
      void router.replace("/chat/new");
    }
  }, [mustRedirect, router]);

  if (mustRedirect) {
    return null;
  }

  return <ChatSurface isNew={isNew} urlChatRef={urlChatRef} />;
};

ChatRoute.getLayout = (page) => <HubLayout>{page}</HubLayout>;

export default ChatRoute;
