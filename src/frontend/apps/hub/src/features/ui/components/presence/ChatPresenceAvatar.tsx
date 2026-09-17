import { useAvatarSrc } from "@/features/chat/hooks/useAvatarSrc";
import { useChatUserPresence } from "@/features/chat/hooks/useChatUserPresence";
import type { Chat } from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

import { UserPresenceIndicator } from "./UserPresenceIndicator";

/** One conversation avatar; only a real one-to-one counterpart gets presence. */
export const ChatPresenceAvatar = ({ chat }: { chat: Chat }) => {
  const src = useAvatarSrc(chat.accountId, chat.visual);
  const counterpartId =
    chat.kind === "direct" && chat.participantIds.length === 1
      ? chat.participantIds[0]
      : "";
  const presence = useChatUserPresence(chat.accountId, counterpartId);

  const avatar = (() => {
    if (chat.visual.kind === "image") {
      return <Avatar label={chat.name} src={src} decorative />;
    }
    if (chat.visual.kind === "emoji") {
      return (
        <Avatar label={chat.name} variant="soft" decorative>
          {chat.visual.emoji}
        </Avatar>
      );
    }
    if (chat.visual.kind === "icon") {
      return (
        <Avatar label={chat.name} decorative>
          <span className="material-icons" aria-hidden="true">
            {chat.visual.icon}
          </span>
        </Avatar>
      );
    }
    return <Avatar label={chat.name} decorative />;
  })();

  return (
    <span className="hub__presence-avatar">
      {avatar}
      {counterpartId && (
        <UserPresenceIndicator
          state={presence?.state ?? null}
          placement="avatar"
        />
      )}
    </span>
  );
};
