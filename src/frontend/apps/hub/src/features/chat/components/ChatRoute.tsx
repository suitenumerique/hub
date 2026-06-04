import { useRouter } from "next/router";

import { readChatRef } from "@/features/chat/chatRefs";
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
  const isNew = router.pathname === "/chat/new";
  const urlChatRef = router.isReady ? readChatRef(router.query) : null;

  return <ChatSurface isNew={isNew} urlChatRef={urlChatRef} />;
};

ChatRoute.getLayout = (page) => <HubLayout>{page}</HubLayout>;

export default ChatRoute;
