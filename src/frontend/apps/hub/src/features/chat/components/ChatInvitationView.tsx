import { useRouter } from "next/router";
import { useCallback } from "react";

import type { Chat, ChatRef } from "@/features/drivers/types";

import { useChatInvitation } from "../hooks/useChatInvitation";

import { ChatInvitation } from "./ChatInvitation";

type ChatInvitationViewProps = {
  chatRef: ChatRef;
  /** The invited conversation (`membership === "invite"`). */
  chat: Chat;
};

/**
 * Container for the invitation detail view: wires the accept/refuse actions to
 * the driver through `useChatInvitation` and owns the post-action navigation.
 *
 * - **Accept** keeps the current route: the hook writes the now-joined chat into
 *   the single-chat cache, which flips `ChatView` out of the invitation branch
 *   in place, so the same URL renders the normal conversation.
 * - **Dismiss** navigates to `/chat/new`, because the current URL points at the
 *   room the user just left.
 *
 * Failures are surfaced as a toast by the hook; the rejection is swallowed here
 * so the invitation detail view stays visible.
 */
export const ChatInvitationView = ({
  chatRef,
  chat,
}: ChatInvitationViewProps) => {
  const router = useRouter();
  const { accept, refuse, isAccepting, isRefusing } =
    useChatInvitation(chatRef);

  const handleAccept = useCallback(() => {
    void accept().catch(() => {
      // Toast already shown by the hook; stay on the invitation view.
    });
  }, [accept]);

  const handleRefuse = useCallback(() => {
    void refuse()
      .then(() => {
        void router.push("/chat/new");
      })
      .catch(() => {
        // Toast already shown by the hook; stay on the invitation view.
      });
  }, [refuse, router]);

  return (
    <ChatInvitation
      chat={chat}
      onAccept={handleAccept}
      onRefuse={handleRefuse}
      isAccepting={isAccepting}
      isRefusing={isRefusing}
    />
  );
};
