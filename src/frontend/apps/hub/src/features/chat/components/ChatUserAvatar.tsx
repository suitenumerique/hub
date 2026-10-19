import type { AccountId, ChatMessageAuthor } from "@/features/drivers/types";
import {
  Avatar,
  type AvatarSize,
} from "@/features/ui/components/avatar/Avatar";
import type { AvatarColor } from "@/features/ui/components/avatar/palette";

import { useChatAvatarUrl } from "../hooks/useChatAvatarUrl";

type ChatUserAvatarProps = {
  accountId: AccountId | null;
  user: Pick<ChatMessageAuthor, "name" | "avatarUrl"> & {
    color?: AvatarColor;
    initials?: string;
  };
  size?: AvatarSize;
};

/**
 * A person's avatar: their picture over their initials, which stay visible
 * while it loads or when it fails.
 */
export const ChatUserAvatar = ({
  accountId,
  user,
  size = "sm",
}: ChatUserAvatarProps) => {
  const imageUrl = useChatAvatarUrl(accountId, user.avatarUrl);
  return (
    <Avatar
      label={user.name}
      color={user.color}
      decorative
      size={size}
      imageUrl={imageUrl}
    >
      {user.initials}
    </Avatar>
  );
};
