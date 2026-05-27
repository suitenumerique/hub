import type { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";

import { ChatView } from "@/features/chat/components/ChatView";
import { MOCK_CHATS } from "@/features/drivers/mocks/mockChats";
import { HubLayout } from "@/features/layouts/HubLayout";
import type { NextPageWithLayout } from "@/features/layouts/NextPageWithLayout";

// `getStaticPaths` is required for dynamic routes under `output: "export"`. We
// intentionally keep `getStaticProps` empty so navigating between two chats no
// longer triggers a blocking `/_next/data/.../[chatId].json` round-trip — the
// `chat` object is fetched client-side inside `ChatView`. `MOCK_CHATS` is read
// here only at build-time to enumerate the static pages; once the backend
// ships, this will move to `fallback: "blocking"` or client-only routing.
export const getStaticPaths: GetStaticPaths = () => ({
  paths: MOCK_CHATS.map((chat) => ({ params: { chatId: chat.id } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps = () => ({ props: {} });

const ChatPage: NextPageWithLayout = () => {
  const router = useRouter();
  const chatId =
    router.isReady && typeof router.query.chatId === "string"
      ? router.query.chatId
      : null;
  if (!chatId) {
    return null;
  }
  return <ChatView chatId={chatId} />;
};

ChatPage.getLayout = (page) => <HubLayout>{page}</HubLayout>;

export default ChatPage;
