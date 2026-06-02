import type { GetStaticPaths, GetStaticProps } from "next";

import { MOCK_CHATS } from "@/features/drivers/mocks/mockChats";

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

// Shared with `/chat/new` — see that route for the rationale.
export { default } from "@/features/chat/components/ChatRoute";
