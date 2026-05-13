import type { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";

import { ChatConversation } from "@/features/chat/components/ChatConversation";
import { ChatHeader } from "@/features/chat/components/header/ChatHeader";
import { MOCK_CHATS, getMockChat } from "@/features/chat/mockChats";
import { HubLayout } from "@/features/layouts/HubLayout";

// `getStaticPaths` is required for dynamic routes under `output: "export"`. We
// intentionally keep `getStaticProps` empty so navigating between two chats no
// longer triggers a blocking `/_next/data/.../[chatId].json` round-trip — the
// `chat` object is derived client-side from `MOCK_CHATS`.
export const getStaticPaths: GetStaticPaths = () => ({
  paths: MOCK_CHATS.map((chat) => ({ params: { chatId: chat.id } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps = () => ({ props: {} });

export default function ChatPage() {
  const router = useRouter();

  if (!router.isReady) {
    return null;
  }

  const chatId =
    typeof router.query.chatId === "string" ? router.query.chatId : null;
  const chat = chatId ? getMockChat(chatId) : null;

  if (!chat) {
    return null;
  }

  return (
    <HubLayout>
      <ChatHeader chat={chat} />
      <ChatConversation chatId={chat.id} />
    </HubLayout>
  );
}
