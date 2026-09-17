import type { ChatVisual } from "@/features/drivers/types";

/** Shared by every search result row that shows a chat's `Avatar`. */
export const renderChatAvatarContent = (visual: ChatVisual) => {
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
      return null;
  }
};
