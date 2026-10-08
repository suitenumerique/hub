import type { Chat, ChatVisual } from "@/features/drivers/types";
import {
  Avatar,
  type AvatarSize,
} from "@/features/ui/components/avatar/Avatar";

import { useChatAvatarUrl } from "../hooks/useChatAvatarUrl";

/** Emoji, icon, or nothing for the default initials. */
const visualContent = (visual: ChatVisual) => {
  switch (visual.kind) {
    case "emoji":
      return visual.emoji;
    case "icon":
      return (
        <span className="material-icons" aria-hidden="true">
          {visual.icon}
        </span>
      );
    default:
      return undefined;
  }
};

/**
 * A conversation's avatar: its image when it has one, shown over its visual,
 * which also stays while the image loads or when it fails.
 */
export const ChatVisualAvatar = ({
  chat,
  size,
}: {
  chat: Chat;
  size?: AvatarSize;
}) => {
  const imageUrl = useChatAvatarUrl(chat.accountId, chat.avatarUrl);
  return (
    <Avatar
      label={chat.name}
      decorative
      size={size}
      variant={chat.visual.kind === "emoji" ? "soft" : "solid"}
      imageUrl={imageUrl}
    >
      {visualContent(chat.visual)}
    </Avatar>
  );
};
