import type { Chat, ChatVisual } from "@/features/drivers/types";
import {
  Avatar,
  type AvatarSize,
} from "@/features/ui/components/avatar/Avatar";

import { useChatAvatarUrl } from "../hooks/useChatAvatarUrl";
import { ChatGroupIcon } from "./ChatGroupIcon";

// Icons the UI kit does not ship yet, drawn from the design.
const DESIGN_ICONS: Record<string, typeof ChatGroupIcon> = {
  groups: ChatGroupIcon,
};

/** Emoji, icon, or nothing for the default initials. */
const visualContent = (visual: ChatVisual) => {
  switch (visual.kind) {
    case "emoji":
      return visual.emoji;
    case "icon": {
      const DesignIcon = DESIGN_ICONS[visual.icon];
      return DesignIcon ? (
        <DesignIcon className="hub__avatar__icon" />
      ) : (
        <span className="material-icons" aria-hidden="true">
          {visual.icon}
        </span>
      );
    }
    default:
      return undefined;
  }
};

/**
 * A conversation's avatar: its image once it has loaded, its visual while
 * the image loads or when it fails.
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
