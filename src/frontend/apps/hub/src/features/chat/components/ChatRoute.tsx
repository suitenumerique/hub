import { useRouter } from "next/router";

import { readChatRef } from "@/features/chat/chatRefs";
import { HubLayout } from "@/features/layouts/HubLayout";
import type { NextPageWithLayout } from "@/features/layouts/NextPageWithLayout";

import { ChatView } from "./ChatView";
import { NewChatView } from "./NewChatView";

/**
 * Shared page component for both `/chat/new` and `/chat` (an existing
 * conversation, addressed by the `?account=&chat=` query). Reading the router
 * here — instead of letting each route file mount its own page subtree — keeps
 * a single component instance across the transition between the two routes, so
 * the surrounding tools panel and account selector survive the navigation
 * instead of flashing during the unmount/remount.
 */
const ChatRoute: NextPageWithLayout = () => {
  const router = useRouter();

  if (router.pathname === "/chat/new") {
    return <NewChatView />;
  }

  const chatRef = router.isReady ? readChatRef(router.query) : null;

  return <ChatView chatRef={chatRef} />;
};

ChatRoute.getLayout = (page) => <HubLayout>{page}</HubLayout>;

export default ChatRoute;
